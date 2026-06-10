import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { getCategoryLabel } from '@/lib/hr/expenses'
import { format } from 'date-fns'

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const expense = await db.expense.findUnique({
    where: { id: params.id },
    include: {
      user: {
        select: {
          id: true, name: true, email: true,
          employeeProfile: { select: { designation: true } },
          reportingManager: { select: { id: true, name: true, email: true } },
        },
      },
      items: true,
    },
  })

  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (expense.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (expense.status !== 'DRAFT' && expense.status !== 'REJECTED')
    return NextResponse.json({ error: 'Already submitted' }, { status: 400 })
  if (expense.items.length === 0)
    return NextResponse.json({ error: 'Add at least one expense item before submitting' }, { status: 400 })

  const updated = await db.expense.update({
    where: { id: params.id },
    data: { status: 'SUBMITTED', submittedAt: new Date() },
  })

  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://lms.trustivasetu.com'
  const approveUrl = `${baseUrl}/expenses/${params.id}`

  const itemRows = expense.items.map(i =>
    `<tr><td style="padding:6px 8px;border-bottom:1px solid #f3f4f6">${format(new Date(i.date), 'dd MMM')}</td>
     <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6">${getCategoryLabel(i.category)}</td>
     <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6">${i.description}</td>
     <td style="padding:6px 8px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600">${formatINR(i.amount)}</td></tr>`
  ).join('')

  const emailHtml = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f5;margin:0;padding:32px 0">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;margin:0 auto;box-shadow:0 2px 8px rgba(0,0,0,.08)">
  <tr><td style="background:#0F172A;padding:20px 32px;text-align:center">
    <span style="color:#A3E635;font-weight:bold;font-size:16px">Trustiva Setu LMS</span>
  </td></tr>
  <tr><td style="padding:28px 32px">
    <h2 style="margin:0 0 8px;color:#111827">Expense Approval Required</h2>
    <p style="color:#6b7280;font-size:14px;margin:0 0 20px">
      <strong>${expense.user.name}</strong> (${expense.user.employeeProfile?.designation ?? 'Employee'}) has submitted an expense report for your approval.
    </p>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
      <tr style="background:#f9fafb">
        <td style="padding:6px 8px;font-weight:600">Period</td>
        <td style="padding:6px 8px">${format(new Date(expense.periodStart), 'dd MMM yyyy')} — ${format(new Date(expense.periodEnd), 'dd MMM yyyy')}</td>
      </tr>
      <tr><td style="padding:6px 8px;font-weight:600">Total Amount</td>
        <td style="padding:6px 8px;color:#16a34a;font-weight:bold">${formatINR(expense.totalAmount)}</td></tr>
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
      <thead><tr style="background:#f9fafb">
        <th style="padding:6px 8px;text-align:left">Date</th>
        <th style="padding:6px 8px;text-align:left">Category</th>
        <th style="padding:6px 8px;text-align:left">Description</th>
        <th style="padding:6px 8px;text-align:right">Amount</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div style="text-align:center;margin:24px 0">
      <a href="${approveUrl}" style="display:inline-block;background:#0F172A;color:#A3E635;font-weight:bold;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none">
        Review & Approve →
      </a>
    </div>
  </td></tr>
  <tr><td style="background:#f9fafb;padding:14px 32px;text-align:center;font-size:11px;color:#9ca3af">
    Trustiva Setu LMS — Automated notification
  </td></tr>
</table></body></html>`

  // Email to manager (or admins if no manager) — fire-and-forget so email failure
  // does not return 500 after the DB record is already SUBMITTED
  void (async () => {
    try {
      const managerEmail = expense.user.reportingManager?.email
      if (managerEmail) {
        await sendEmail({
          to: managerEmail,
          subject: `Expense Approval: ${expense.user.name} — ${formatINR(expense.totalAmount)}`,
          html: emailHtml,
        })
      } else {
        const admins = await db.user.findMany({ where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] }, isActive: true }, select: { email: true } })
        for (const a of admins) {
          await sendEmail({ to: a.email, subject: `Expense Approval: ${expense.user.name} — ${formatINR(expense.totalAmount)}`, html: emailHtml })
        }
      }
    } catch (e) {
      console.error('[Expense Submit Email Error]', e)
    }
  })()

  return NextResponse.json({ data: updated })
}
