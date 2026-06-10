import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  action: z.enum(['approve', 'reject']),
  comment: z.string().optional(),
})

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = session.user.role as string
  if (!['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden — only managers can approve leaves' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed' }, { status: 400 })
  }

  const existing = await db.leaveRequest.findUnique({ where: { id: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const leave = await db.leaveRequest.update({
    where: { id: params.id },
    data: {
      status: parsed.data.action === 'approve' ? 'APPROVED' : 'REJECTED',
      approverComment: parsed.data.comment ?? null,
      approvedById: session.user.id,
      approvedAt: new Date(),
    },
    include: { user: { select: { id: true, name: true } } },
  })

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: parsed.data.action === 'approve' ? 'APPROVE' : 'REJECT',
      entity: 'LeaveRequest',
      entityId: params.id,
    },
  })

  // Notify the employee
  await db.notification.create({
    data: {
      userId: existing.userId,
      title: `Leave ${parsed.data.action === 'approve' ? 'Approved' : 'Rejected'}`,
      message: `Your leave request has been ${parsed.data.action === 'approve' ? 'approved' : 'rejected'}${parsed.data.comment ? `: ${parsed.data.comment}` : ''}`,
      type: parsed.data.action === 'approve' ? 'SUCCESS' : 'WARNING',
      link: '/dashboard/my/leaves',
    },
  })

  return NextResponse.json({ data: leave })
}
