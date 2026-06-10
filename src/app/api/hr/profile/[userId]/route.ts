import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  dateOfBirth: z.string().nullable().optional(),
  dateOfJoining: z.string().nullable().optional(),
  marriageAnniversary: z.string().nullable().optional(),
  designation: z.string().optional(),
  department: z.string().optional(),
  probationEndDate: z.string().nullable().optional(),
  exitDate: z.string().nullable().optional(),
  // user-level fields
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
})

export async function GET(req: NextRequest, context: { params: Promise<{ userId: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = session.user.role === 'SUPER_ADMIN' || session.user.role === 'ADMIN'
  const isSelf = session.user.id === params.userId
  if (!isAdmin && !isSelf) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const user = await db.user.findUnique({
    where: { id: params.userId },
    select: {
      id: true, name: true, email: true, phone: true, role: true, createdAt: true, employeeProfile: true,
      reportingManager: {
        select: {
          id: true, name: true, role: true,
          reportingManager: {
            select: {
              id: true, name: true, role: true,
              reportingManager: { select: { id: true, name: true, role: true } },
            },
          },
        },
      },
    },
  })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ data: user })
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ userId: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = session.user.role === 'SUPER_ADMIN' || session.user.role === 'ADMIN'
  const isSelf = session.user.id === params.userId
  if (!isAdmin && !isSelf) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })

  const { name, phone, ...profileData } = parsed.data

  if (name || phone !== undefined) {
    await db.user.update({
      where: { id: params.userId },
      data: { ...(name && { name }), ...(phone !== undefined && { phone }) },
    })
  }

  const profileUpdate: Record<string, unknown> = {}
  if ('dateOfBirth' in profileData)
    profileUpdate.dateOfBirth = profileData.dateOfBirth ? new Date(profileData.dateOfBirth) : null
  if ('dateOfJoining' in profileData)
    profileUpdate.dateOfJoining = profileData.dateOfJoining ? new Date(profileData.dateOfJoining) : null
  if ('marriageAnniversary' in profileData)
    profileUpdate.marriageAnniversary = profileData.marriageAnniversary ? new Date(profileData.marriageAnniversary) : null
  if ('probationEndDate' in profileData)
    profileUpdate.probationEndDate = profileData.probationEndDate ? new Date(profileData.probationEndDate) : null
  if ('exitDate' in profileData)
    profileUpdate.exitDate = profileData.exitDate ? new Date(profileData.exitDate) : null
  if (profileData.designation !== undefined) profileUpdate.designation = profileData.designation
  if (profileData.department !== undefined) profileUpdate.department = profileData.department

  if (Object.keys(profileUpdate).length > 0) {
    await db.employeeProfile.upsert({
      where: { userId: params.userId },
      create: { userId: params.userId, ...profileUpdate },
      update: profileUpdate,
    })
  }

  const updated = await db.user.findUnique({
    where: { id: params.userId },
    select: {
      id: true, name: true, email: true, phone: true, role: true, createdAt: true, employeeProfile: true,
      reportingManager: { select: { id: true, name: true, role: true, reportingManager: { select: { id: true, name: true, role: true } } } },
    },
  })
  return NextResponse.json({ data: updated })
}
