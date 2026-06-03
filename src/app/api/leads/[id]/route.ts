import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { buildClinicFilter, hasPermission } from '@/lib/permissions'
import { checkRolePermission } from '@/lib/role-permissions'
import { notifyClinicRM, createNotification } from '@/lib/notify'
import { z } from 'zod'

const updateSchema = z.object({
  applicantName: z.string().min(2).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  amount: z.number().positive().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'DISBURSED', 'CANCELLED']).optional(),
  approvedAmount: z.number().optional(),
  disbursedAmount: z.number().optional(),
  lenderId: z.string().optional(),
  approvalDate: z.string().optional(),
  disbursalDate: z.string().optional(),
  remarks: z.string().optional(),
  clinicId: z.string().cuid().optional(),
  treatmentName: z.string().optional(),
  motherName: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  treatmentCategory: z.string().optional(),
  utrNumber: z.string().optional(),
  nachStatus: z.string().optional(),
  agreementSigned: z.boolean().optional(),
  rejectionReason: z.string().optional(),
})

async function canAccessLead(leadClinicId: string, role: string, regionIds: string[], clinicIds: string[]): Promise<boolean> {
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true
  const filter = buildClinicFilter(role, regionIds, clinicIds)
  const count = await db.clinic.count({ where: { id: leadClinicId, ...filter } })
  return count > 0
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const lead = await db.lead.findUnique({
      where: { id: params.id },
      include: {
        clinic: { include: { region: true } },
        lender: true,
        createdBy: { select: { id: true, name: true } },
      },
    })
    if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { role, regionIds, clinicIds } = session.user
    if (!await canAccessLead(lead.clinicId, role, regionIds, clinicIds)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ data: lead })
  } catch (e) {
    console.error('[GET /api/leads/:id]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, 'LEAD_UPDATE')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const bodyPeek = await req.clone().json().catch(() => ({})) as Record<string, unknown>
  const isStatusChange = !!bodyPeek.status
  const permAction = isStatusChange ? 'APPROVE' : 'EDIT'
  if (!await checkRolePermission(session.user.role as string, 'LEADS', permAction)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })

  try {
    const d = parsed.data
    const before = await db.lead.findUnique({
      where: { id: params.id },
      select: { status: true, applicantName: true, clinicId: true },
    })
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { role, regionIds, clinicIds } = session.user
    if (!await canAccessLead(before.clinicId, role, regionIds, clinicIds)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const updateData = {
      applicantName: d.applicantName,
      phone: d.phone,
      email: d.email !== undefined ? (d.email || null) : undefined,
      amount: d.amount,
      status: d.status,
      approvedAmount: d.approvedAmount,
      disbursedAmount: d.disbursedAmount,
      lenderId: d.lenderId || undefined,
      approvalDate: d.approvalDate ? new Date(d.approvalDate) : undefined,
      disbursalDate: d.disbursalDate ? new Date(d.disbursalDate) : undefined,
      remarks: d.remarks,
      clinicId: d.clinicId,
      treatmentName: d.treatmentName,
      motherName: d.motherName !== undefined ? (d.motherName || null) : undefined,
      metadata: d.metadata ? JSON.parse(JSON.stringify(d.metadata)) : undefined,
      treatmentCategory: d.treatmentCategory,
      utrNumber: d.utrNumber,
      nachStatus: d.nachStatus,
      agreementSigned: d.agreementSigned,
      rejectionReason: d.rejectionReason,
    }
    const lead = await db.lead.update({
      where: { id: params.id },
      data: updateData,
      include: { clinic: { select: { id: true, name: true } }, lender: { select: { id: true, name: true } } },
    })

    await db.auditLog.create({
      data: { userId: session.user.id, action: 'UPDATE', entity: 'Lead', entityId: lead.id, details: JSON.stringify({ status: d.status }) },
    })

    if (d.status && d.status !== before.status) {
      const title = `Lead ${d.status.toLowerCase()}`
      const message = `${before.applicantName} is now ${d.status}`
      await notifyClinicRM(before.clinicId, {
        title, message,
        type: d.status === 'DISBURSED' ? 'SUCCESS' : d.status === 'REJECTED' ? 'WARNING' : 'INFO',
        link: `/leads`,
      })
      await createNotification({
        userId: session.user.id,
        title: 'Lead status updated',
        message: `You updated ${before.applicantName} to ${d.status}`,
        type: 'INFO',
        link: '/leads',
      })
    }

    return NextResponse.json({ data: lead })
  } catch (e) {
    console.error('[PATCH /api/leads/:id]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, 'LEAD_DELETE')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const lead = await db.lead.findUnique({ where: { id: params.id }, select: { clinicId: true } })
    if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { role, regionIds, clinicIds } = session.user
    if (!await canAccessLead(lead.clinicId, role, regionIds, clinicIds)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const leadSnapshot = await db.lead.findUnique({
      where: { id: params.id },
      select: { id: true, applicantName: true, phone: true, email: true, amount: true, status: true, clinicId: true, lenderId: true, approvedAmount: true, disbursedAmount: true, utrNumber: true, rejectionReason: true, applicationDate: true },
    })
    if (leadSnapshot) {
      await db.recycleBin.create({
        data: {
          entityType: 'Lead',
          entityId: leadSnapshot.id,
          entityName: leadSnapshot.applicantName,
          deletedBy: session.user.id,
          snapshot: leadSnapshot as object,
        },
      })
    }
    await db.lead.delete({ where: { id: params.id } })
    await db.auditLog.create({ data: { userId: session.user.id, action: 'DELETE', entity: 'Lead', entityId: params.id } })
    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[DELETE /api/leads/:id]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
