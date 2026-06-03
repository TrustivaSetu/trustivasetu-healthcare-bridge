import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const expense = await db.expense.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { name: true, email: true, reportingManagerId: true } },
    },
  })
  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (expense.status !== 'SUBMITTED') return NextResponse.json({ error: 'Expense is not in submitted state' }, { status: 400 })

  const isAdmin = session.user.role === 'SUPER_ADMIN' || session.user.role === 'ADMIN'
  const isReportingManager = expense.user.reportingManagerId === session.user.id
  if (!isAdmin && !isReportingManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { action, reason, approvedAmount } = await req.json()
  if (!['approve', 'partial', 'reject'].includes(action))
    return NextResponse.json({ error: 'action must be approve, partial, or reject' }, { status: 400 })

  let newStatus: 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED' = 'APPROVED'
  if (action === 'partial') newStatus = 'PARTIALLY_APPROVED'
  if (action === 'reject') newStatus = 'REJECTED'

  const updated = await db.expense.update({
    where: { id: params.id },
    data: {
      status: newStatus,
      approvedById: session.user.id,
      approvedAt: new Date(),
      rejectionReason: action === 'reject' ? (reason || 'No reason provided') : null,
      approvedAmount: action === 'partial' ? (approvedAmount ?? expense.totalAmount) : action === 'approve' ? expense.totalAmount : null,
    },
  })

  const statusLabel = newStatus === 'APPROVED' ? 'Approved ✓' : newStatus === 'PARTIALLY_APPROVED' ? 'Partially Approved' : 'Rejected ✗'
  const amountLine = newStatus !== 'REJECTED'
    ? `<p style="font-size:14px;color:#6b7280">Approved Amount: <strong style="color:#16a34a">${formatINR(updated.approvedAmount ?? expense.totalAmount)}</strong></p>`
    : ''
  const reasonLine = reason ? `<p style="font-size:14px;color:#dc2626;background:#fef2f2;padding:10px;border-radius:6px;margin-top:10px">Reason: ${reason}</p>` : ''

  void (async () => {
    try {
      await sendEmail({
        to: expense.user.email,
        subject: `Your Expense Report has been ${statusLabel}`,
        html: `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f5;margin:0;padding:32px 0">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;margin:0 auto">
  <tr><td style="background:#0F172A;padding:20px 32px;text-align:center"><span style="color:#A3E635;font-weight:bold;font-size:16px">Trustiva Setu LMS</span></td></tr>
  <tr><td style="padding:28px 32px">
    <h2 style="margin:0 0 8px;color:#111827">Expense Report — ${statusLabel}</h2>
    <p style="font-size:14px;color:#6b7280">Your expense report "<strong>${expense.title}</strong>" has been reviewed.</p>
    ${amountLine}${reasonLine}
    <p style="font-size:12px;color:#9ca3af;margin-top:20px">Log in to Trustiva Setu LMS to view full details.</p>
  </td></tr>
</table></body></html>`,
      })
    } catch (e) {
      console.error('[Expense Approval Email Error]', e)
    }
  })()

  return NextResponse.json({ data: updated })
}
