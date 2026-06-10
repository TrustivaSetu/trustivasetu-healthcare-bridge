import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'TEAM_MEMBER', 'CLINIC_USER']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
  mustChangePassword: z.boolean().optional(),
  designation: z.string().nullable().optional(),
  regionIds: z.array(z.string()).optional(),
  clinicIds: z.array(z.string()).optional(),
  reportingManagerId: z.string().nullable().optional(),
})

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, 'USER_READ') && session.user.id !== params.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const user = await db.user.findUnique({
    where: { id: params.id },
    select: {
      id: true, email: true, name: true, role: true, isActive: true, phone: true, createdAt: true,
      reportingManagerId: true,
      employeeProfile: { select: { designation: true } },
      reportingManager: {
        select: {
          id: true, name: true, role: true,
          employeeProfile: { select: { designation: true } },
          reportingManager: {
            select: {
              id: true, name: true, role: true,
              employeeProfile: { select: { designation: true } },
              reportingManager: {
                select: {
                  id: true, name: true, role: true,
                  employeeProfile: { select: { designation: true } },
                },
              },
            },
          },
        },
      },
      regionAssignments: { include: { region: true } },
      clinicAssignments: { include: { clinic: { select: { id: true, name: true } } } },
    },
  })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({
    data: {
      ...user,
      designation: user.employeeProfile?.designation ?? null,
    },
  })
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, 'USER_UPDATE')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })

  if (parsed.data.role === 'SUPER_ADMIN' && session.user.role !== 'SUPER_ADMIN')
    return NextResponse.json({ error: 'Only Super Admin can assign Super Admin role' }, { status: 403 })

  const { regionIds, clinicIds, password, reportingManagerId, designation, ...rest } = parsed.data
  const updateData: Record<string, unknown> = { ...rest }
  if (password) {
    updateData.password = await bcrypt.hash(password, 12)
    updateData.mustChangePassword = false
  }
  if (reportingManagerId !== undefined) updateData.reportingManagerId = reportingManagerId ?? null

  if (regionIds !== undefined) {
    await db.userRegion.deleteMany({ where: { userId: params.id } })
    if (regionIds.length)
      await db.userRegion.createMany({ data: regionIds.map(rid => ({ userId: params.id, regionId: rid })) })
  }
  if (clinicIds !== undefined) {
    await db.userClinic.deleteMany({ where: { userId: params.id } })
    if (clinicIds.length)
      await db.userClinic.createMany({ data: clinicIds.map(cid => ({ userId: params.id, clinicId: cid })) })
  }

  await db.user.update({ where: { id: params.id }, data: updateData })

  // Upsert designation into EmployeeProfile
  if (designation !== undefined) {
    await db.employeeProfile.upsert({
      where: { userId: params.id },
      create: { userId: params.id, designation: designation ?? null },
      update: { designation: designation ?? null },
    })
  }

  const user = await db.user.findUnique({
    where: { id: params.id },
    select: {
      id: true, email: true, name: true, role: true, isActive: true,
      employeeProfile: { select: { designation: true } },
    },
  })

  await db.auditLog.create({ data: { userId: session.user.id, action: 'UPDATE', entity: 'User', entityId: params.id } })
  return NextResponse.json({ data: { ...user, designation: user?.employeeProfile?.designation ?? null } })
}

const PROTECTED_EMAILS = ['admin@trustivasetu.com']

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, 'USER_DELETE')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (params.id === session.user.id) return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })

  const target = await db.user.findUnique({
    where: { id: params.id },
    select: { id: true, email: true, name: true, role: true, phone: true, password: true, isActive: true, createdAt: true },
  })
  if (!target) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (PROTECTED_EMAILS.includes(target.email)) {
    return NextResponse.json({ error: 'This account cannot be deleted' }, { status: 403 })
  }

  await db.recycleBin.create({
    data: {
      entityType: 'User',
      entityId: target.id,
      entityName: `${target.name} (${target.email})`,
      deletedBy: session.user.id,
      snapshot: target as object,
    },
  })
  await db.user.delete({ where: { id: params.id } })
  await db.auditLog.create({ data: { userId: session.user.id, action: 'DELETE', entity: 'User', entityId: params.id } })
  return NextResponse.json({ success: true })
}
