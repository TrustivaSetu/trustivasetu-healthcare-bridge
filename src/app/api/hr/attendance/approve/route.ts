import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { sendEmail, attendanceStatusHtml } from '@/lib/email'
import { format } from 'date-fns'

// Public GET — called from email link (no auth required, token-validated)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  const action = searchParams.get('action') // 'approve' | 'reject'

  if (!token || !action) return htmlResponse('Missing Parameters', 'Invalid link. Token or action is missing.', false)

  const record = await db.attendance.findUnique({
    where: { approvalToken: token },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  })

  if (!record) return htmlResponse('Invalid Link', 'This approval link is invalid or has already been used.', false)

  // Check 24-hour expiry on the token
  const hoursElapsed = (Date.now() - record.createdAt.getTime()) / 3600000
  if (hoursElapsed > 48) return htmlResponse('Link Expired', 'This approval link has expired (48 hours).', false)

  if (record.approvalStatus !== 'PENDING')
    return htmlResponse('Already Processed', `This attendance has already been ${record.approvalStatus.toLowerCase()}.`, true)

  if (action === 'approve') {
    await db.attendance.update({
      where: { id: record.id },
      data: { approvalStatus: 'APPROVED', approvalToken: null, approvedAt: new Date() },
    })
    // Email employee
    const dateStr = format(new Date(record.date), 'dd MMM yyyy')
    await sendEmail({
      to: record.user.email,
      subject: 'Attendance Approved',
      html: attendanceStatusHtml('APPROVED', record.user.name, dateStr),
    })
    return htmlResponse('Approved!', `Attendance for ${record.user.name} on ${dateStr} has been approved.`, true)
  }

  if (action === 'reject') {
    // Return a form for rejection reason
    const dateStr = format(new Date(record.date), 'dd MMM yyyy')
    return new NextResponse(rejectFormHtml(token, record.user.name, dateStr), {
      headers: { 'Content-Type': 'text/html' },
    })
  }

  return htmlResponse('Unknown Action', 'Invalid action specified.', false)
}

// POST — called from reject form (rejection reason submission)
export async function POST(req: NextRequest) {
  const body = await req.formData()
  const token = body.get('token') as string
  const reason = (body.get('reason') as string) ?? ''

  if (!token) return htmlResponse('Error', 'Missing token.', false)

  const record = await db.attendance.findUnique({
    where: { approvalToken: token },
    include: { user: { select: { name: true, email: true } } },
  })

  if (!record || record.approvalStatus !== 'PENDING')
    return htmlResponse('Error', 'Invalid or already processed attendance record.', false)

  await db.attendance.update({
    where: { id: record.id },
    data: { approvalStatus: 'REJECTED', approvalToken: null, approvedAt: new Date(), rejectionReason: reason || 'No reason provided' },
  })

  const dateStr = format(new Date(record.date), 'dd MMM yyyy')
  await sendEmail({
    to: record.user.email,
    subject: 'Attendance Rejected',
    html: attendanceStatusHtml('REJECTED', record.user.name, dateStr, reason),
  })

  return htmlResponse('Rejected', `Attendance for ${record.user.name} on ${dateStr} has been rejected.`, true)
}

// Admin or manager direct approve/reject via authenticated API
export async function PATCH(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const isAdmin = session.user.role === 'SUPER_ADMIN' || session.user.role === 'ADMIN'
  const isManager = session.user.role === 'REGIONAL_MANAGER'
  if (!isAdmin && !isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { attendanceId, action, reason } = await req.json()
  if (!attendanceId || !action) return NextResponse.json({ error: 'attendanceId and action required' }, { status: 400 })

  const record = await db.attendance.findUnique({
    where: { id: attendanceId },
    include: { user: { select: { name: true, email: true, reportingManagerId: true } } },
  })
  if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Managers can only approve their direct reports
  if (isManager && !isAdmin && record.user.reportingManagerId !== session.user.id) {
    return NextResponse.json({ error: 'You can only approve attendance for your direct reports' }, { status: 403 })
  }

  const status = action === 'approve' ? 'APPROVED' : 'REJECTED'
  const updated = await db.attendance.update({
    where: { id: attendanceId },
    data: {
      approvalStatus: status,
      approvalToken: null,
      approvedById: session.user.id,
      approvedAt: new Date(),
      ...(status === 'REJECTED' && { rejectionReason: reason ?? 'Rejected by admin' }),
    },
  })

  const dateStr = format(new Date(record.date), 'dd MMM yyyy')
  void (async () => {
    try {
      await sendEmail({
        to: record.user.email,
        subject: `Attendance ${status === 'APPROVED' ? 'Approved' : 'Rejected'}`,
        html: attendanceStatusHtml(status, record.user.name, dateStr, reason),
      })
    } catch (e) {
      console.error('[Attendance Approval Email Error]', e)
    }
  })()

  return NextResponse.json({ data: updated })
}

function htmlResponse(title: string, message: string, success: boolean) {
  const icon = success ? '✓' : '✗'
  const color = success ? '#16a34a' : '#dc2626'
  const bg = success ? '#dcfce7' : '#fee2e2'
  return new NextResponse(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${title} — Trustiva Setu</title>
<style>body{margin:0;font-family:Arial,sans-serif;background:#f4f4f5;display:flex;align-items:center;justify-content:center;min-height:100vh;}
.card{background:#fff;border-radius:12px;padding:40px;max-width:420px;text-align:center;box-shadow:0 4px 16px rgba(0,0,0,.1);}
.icon{width:64px;height:64px;border-radius:50%;background:${bg};color:${color};font-size:28px;line-height:64px;margin:0 auto 20px;}
h1{margin:0 0 8px;font-size:22px;color:#111827;}p{margin:0;color:#6b7280;font-size:14px;}</style></head>
<body><div class="card"><div class="icon">${icon}</div><h1>${title}</h1><p>${message}</p>
<p style="margin-top:20px;font-size:12px;color:#9ca3af;">Trustiva Setu LMS</p></div></body></html>`,
    { headers: { 'Content-Type': 'text/html' } })
}

function rejectFormHtml(token: string, empName: string, date: string) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Reject Attendance — Trustiva Setu</title>
<style>body{margin:0;font-family:Arial,sans-serif;background:#f4f4f5;display:flex;align-items:center;justify-content:center;min-height:100vh;}
.card{background:#fff;border-radius:12px;padding:36px;max-width:440px;width:100%;box-shadow:0 4px 16px rgba(0,0,0,.1);}
h1{margin:0 0 6px;font-size:20px;color:#111827;}p{margin:0 0 16px;color:#6b7280;font-size:14px;}
textarea{width:100%;border:1px solid #d1d5db;border-radius:8px;padding:10px;font-size:14px;resize:vertical;box-sizing:border-box;}
button{width:100%;background:#dc2626;color:#fff;border:none;border-radius:8px;padding:12px;font-size:15px;font-weight:bold;cursor:pointer;margin-top:12px;}</style></head>
<body><div class="card">
<h1>Reject Attendance</h1>
<p>Employee: <strong>${empName}</strong> · Date: <strong>${date}</strong></p>
<form method="POST" action="/api/hr/attendance/approve">
  <input type="hidden" name="token" value="${token}">
  <label style="display:block;font-size:13px;font-weight:600;color:#374151;margin-bottom:6px;">Rejection Reason (optional)</label>
  <textarea name="reason" rows="4" placeholder="Enter reason for rejection..."></textarea>
  <button type="submit">✗ Confirm Rejection</button>
</form>
</div></body></html>`
}
