import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import { checkRolePermission } from '@/lib/role-permissions'
import { notifyClinicRM, createNotification } from '@/lib/notify'
import { z } from 'zod'

const updateSchema = z.object({
  applicantName: z.string().min(2).optional(),
  phone: z.string().optional(),
  amount: z.number().positive().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'DISBURSED', 'CANCELLED']).optional(),
  approvedAmount: z.number().optional(),
  disbursedAmount: z.number().optional(),
  lenderId: z.string().optional(),
  approvalDate: z.string().optional(),
  disbursalDate: z.string().optional(),
  remarks: z.string().optional(),
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const lead = await db.lead.findUnique({
    where: { id: params.id },
    include: {
      clinic: { include: { region: true } },
      lender: true,
      createdBy: { select: { id: true, name: true } },
    },
  })
  if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ data: lead })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, 'LEAD_UPDATE')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Dynamic permission: check EDIT or APPROVE based on payload
  const bodyPeek = await req.clone().json().catch(() => ({})) as Record<string, unknown>
  const isStatusChange = !!bodyPeek.status
  const permAction = isStatusChange ? 'APPROVE' : 'EDIT'
  if (!await checkRolePermission(session.user.role as string, 'LEADS', permAction)) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })

  const d = parsed.data
  const before = await db.lead.findUnique({
    where: { id: params.id },
    select: { status: true, applicantName: true, clinicId: true },
  })

  const lead = await db.lead.update({
    where: { id: params.id },
    data: {
      ...d,
      lenderId: d.lenderId || undefined,
      approvalDate: d.approvalDate ? new Date(d.approvalDate) : undefined,
      disbursalDate: d.disbursalDate ? new Date(d.disbursalDate) : undefined,
    },
    include: { clinic: { select: { id: true, name: true } }, lender: { select: { id: true, name: true } } },
  })

  await db.auditLog.create({ data: { userId: session.user.id, action: 'UPDATE', entity: 'Lead', entityId: lead.id, details: JSON.stringify({ status: d.status }) } })

  if (d.status && before && d.status !== before.status) {
    const title = `Lead ${d.status.toLowerCase()}`
    const message = `${before.applicantName} is now ${d.status}`
    await notifyClinicRM(before.clinicId, { title, message, type: d.status === 'DISBURSED' ? 'SUCCESS' : d.status === 'REJECTED' ? 'WARNING' : 'INFO', link: `/leads` })
    await createNotification({
      userId: session.user.id,
      title: 'Lead status updated',
      message: `You updated ${before.applicantName} to ${d.status}`,
      type: 'INFO',
      link: '/leads',
    })
  }

  return NextResponse.json({ data: lead })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, 'LEAD_DELETE')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await db.lead.delete({ where: { id: params.id } })
  await db.auditLog.create({ data: { userId: session.user.id, action: 'DELETE', entity: 'Lead', entityId: params.id } })
  return NextResponse.json({ success: true })
}
