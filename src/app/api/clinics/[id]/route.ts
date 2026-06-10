import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  address: z.string().min(5).optional(),
  accountNumber: z.string().optional(),
  contactPerson: z.string().min(2).optional(),
  contactNumber: z.string().min(10).optional(),
  email: z.string().email().optional().or(z.literal('')),
  businessPotential: z.number().optional(),
  regionId: z.string().cuid().optional(),
  assignedRMId: z.string().optional(),
  isActive: z.boolean().optional(),
  hospitalType: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
})

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clinic = await db.clinic.findUnique({
    where: { id: params.id },
    include: {
      region: true,
      assignedRM: { select: { id: true, name: true, email: true } },
      targets: { where: { year: new Date().getFullYear(), month: new Date().getMonth() + 1 } },
    },
  })
  if (!clinic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ data: clinic })
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, 'CLINIC_UPDATE')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    const errors = parsed.error.flatten()
    console.error('[PATCH /api/clinics/:id] Validation failed:', JSON.stringify(errors, null, 2))
    return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 })
  }

  const { metadata, hospitalType, ...rest } = parsed.data

  const updateData: Record<string, unknown> = {
    ...rest,
    assignedRMId: rest.assignedRMId || null,
    email: rest.email || null,
  }
  if (hospitalType !== undefined) updateData.hospitalType = hospitalType || null
  if (metadata !== undefined) updateData.metadata = JSON.parse(JSON.stringify(metadata))

  const clinic = await db.clinic.update({
    where: { id: params.id },
    data: updateData,
    include: { region: true, assignedRM: { select: { id: true, name: true } } },
  })

  await db.auditLog.create({ data: { userId: session.user.id, action: 'UPDATE', entity: 'Clinic', entityId: clinic.id } })
  return NextResponse.json({ data: clinic })
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, 'CLINIC_DELETE')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const clinic = await db.clinic.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, address: true, contactPerson: true, contactNumber: true, email: true, regionId: true, isActive: true },
  })
  if (!clinic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.recycleBin.create({
    data: {
      entityType: 'Clinic',
      entityId: clinic.id,
      entityName: clinic.name,
      deletedBy: session.user.id,
      snapshot: clinic as object,
    },
  })

  const leads = await db.lead.findMany({
    where: { clinicId: params.id },
    select: { id: true, applicantName: true, phone: true, email: true, amount: true, status: true, clinicId: true, approvedAmount: true, disbursedAmount: true, utrNumber: true, rejectionReason: true },
  })
  for (const lead of leads) {
    await db.recycleBin.create({
      data: {
        entityType: 'Lead',
        entityId: lead.id,
        entityName: lead.applicantName,
        deletedBy: session.user.id,
        snapshot: lead as object,
      },
    })
  }
  await db.lead.deleteMany({ where: { clinicId: params.id } })
  await db.target.deleteMany({ where: { clinicId: params.id } })
  await db.clinic.delete({ where: { id: params.id } })
  await db.auditLog.create({ data: { userId: session.user.id, action: 'DELETE', entity: 'Clinic', entityId: params.id } })
  return NextResponse.json({ success: true })
}
