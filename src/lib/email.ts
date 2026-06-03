import nodemailer from 'nodemailer'

const BRAND = {
  name: 'Trustiva Setu LMS',
  color: '#A3E635',  // trustiva-lime
  dark: '#0F172A',   // trustiva-navy
}

function createTransport() {
  if (!process.env.SMTP_HOST) return null
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

const FROM = process.env.FROM_EMAIL ?? `"${BRAND.name}" <noreply@trustivasetu.com>`

function layout(title: string, body: string) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
  <tr><td style="background:${BRAND.dark};padding:20px 32px;text-align:center;">
    <span style="display:inline-block;background:${BRAND.color};color:${BRAND.dark};font-weight:bold;font-size:14px;padding:6px 14px;border-radius:8px;margin-bottom:6px;">T</span>
    <p style="color:#fff;font-size:16px;font-weight:bold;margin:0;">${BRAND.name}</p>
  </td></tr>
  <tr><td style="padding:32px;">${body}</td></tr>
  <tr><td style="background:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="margin:0;font-size:11px;color:#9ca3af;">This is an automated message from ${BRAND.name}. Do not reply to this email.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`
}

export async function sendEmail({ to, subject, html }: { to: string | string[]; subject: string; html: string }) {
  const transporter = createTransport()
  const toList = Array.isArray(to) ? to.join(', ') : to
  if (!transporter) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`[EMAIL] SMTP not configured — set SMTP_HOST, SMTP_USER, SMTP_PASS. Failed to send to: ${toList}`)
    }
    console.log(`[EMAIL - no SMTP configured] To: ${toList} | Subject: ${subject}`)
    return { success: true, dev: true }
  }
  await transporter.sendMail({ from: FROM, to: toList, subject, html })
  return { success: true }
}

export function otpEmailHtml(otp: string, purpose = 'Password Reset') {
  return layout(`Your OTP — ${BRAND.name}`, `
    <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">${purpose} OTP</h2>
    <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">Use the following one-time password to continue. Valid for <strong>10 minutes</strong>.</p>
    <div style="background:#f3f4f6;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
      <span style="font-size:38px;font-weight:bold;letter-spacing:12px;color:#111827;">${otp}</span>
    </div>
    <p style="font-size:13px;color:#9ca3af;margin:0;">Do not share this OTP with anyone. If you did not request this, please ignore this email.</p>
  `)
}

export function attendanceConfirmHtml(emp: string, date: string, type: string, timeIn: string) {
  return layout('Attendance Recorded', `
    <h2 style="margin:0 0 8px;color:#111827;">Attendance Recorded</h2>
    <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">Your attendance has been recorded and is pending manager approval.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      ${[['Employee', emp], ['Date', date], ['Type', type], ['Time In', timeIn || '—']].map(([k, v]) => `
        <tr><td style="padding:8px 0;color:#6b7280;width:130px;">${k}</td><td style="padding:8px 0;font-weight:600;color:#111827;">${v}</td></tr>
      `).join('')}
    </table>
    <p style="margin:20px 0 0;font-size:13px;color:#9ca3af;">You will receive another email once your manager reviews it.</p>
  `)
}

export function attendanceApprovalRequestHtml(opts: {
  empName: string; empEmail: string; date: string; type: string; timeIn: string; location: string; notes: string; approveUrl: string; rejectUrl: string
}) {
  const { empName, empEmail, date, type, timeIn, location, notes, approveUrl, rejectUrl } = opts
  return layout('Attendance Approval Required', `
    <h2 style="margin:0 0 8px;color:#111827;">Attendance Approval Required</h2>
    <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">An attendance record requires your approval.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px;">
      ${[['Employee', `${empName} (${empEmail})`], ['Date', date], ['Type', type], ['Time In', timeIn || '—'], ['Location', location || '—'], ['Notes', notes || '—']].map(([k, v]) => `
        <tr><td style="padding:8px 0;color:#6b7280;width:110px;">${k}</td><td style="padding:8px 0;font-weight:600;color:#111827;">${v}</td></tr>
      `).join('')}
    </table>
    <div style="text-align:center;margin:24px 0 8px;">
      <a href="${approveUrl}" style="display:inline-block;background:#16a34a;color:#fff;font-weight:bold;font-size:14px;padding:12px 32px;border-radius:8px;text-decoration:none;margin:0 8px;">✓ APPROVE</a>
      <a href="${rejectUrl}" style="display:inline-block;background:#dc2626;color:#fff;font-weight:bold;font-size:14px;padding:12px 32px;border-radius:8px;text-decoration:none;margin:0 8px;">✗ REJECT</a>
    </div>
    <p style="text-align:center;font-size:12px;color:#9ca3af;margin:8px 0 0;">This approval request expires in 24 hours.</p>
  `)
}

export function portalAccessEmailHtml(opts: { clinicName: string; email: string; password: string; loginUrl: string }) {
  const { clinicName, email, password, loginUrl } = opts
  return layout(`Your Trustiva Setu Portal Access — ${clinicName}`, `
    <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Welcome to Trustiva Setu Portal</h2>
    <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">Your clinic portal access has been created for <strong>${clinicName}</strong>. Use the credentials below to log in and view your leads and disbursal reports.</p>
    <div style="background:#f3f4f6;border-radius:10px;padding:20px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:6px 0;color:#6b7280;width:120px;">Login URL</td><td style="padding:6px 0;font-weight:600;color:#111827;"><a href="${loginUrl}" style="color:#0284c7;">${loginUrl}</a></td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Email</td><td style="padding:6px 0;font-weight:600;color:#111827;font-family:monospace;">${email}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;">Password</td><td style="padding:6px 0;font-weight:600;color:#111827;font-family:monospace;">${password}</td></tr>
      </table>
    </div>
    <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:12px 16px;font-size:13px;color:#713f12;margin-bottom:16px;">
      <strong>Important:</strong> You will be asked to change your password on first login. Please keep your credentials secure.
    </div>
    <p style="font-size:13px;color:#9ca3af;margin:0;">If you did not expect this email, please contact your Trustiva Setu relationship manager immediately.</p>
  `)
}

export function monthlyReportEmailHtml(opts: { clinicName: string; month: string; year: number; totalLeads: number }) {
  const { clinicName, month, year, totalLeads } = opts
  return layout(`Monthly Lead Report — ${clinicName} — ${month} ${year}`, `
    <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Monthly Lead Report</h2>
    <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">Please find attached the consolidated lead report for <strong>${clinicName}</strong> for the month of <strong>${month} ${year}</strong>.</p>
    <div style="background:#f3f4f6;border-radius:10px;padding:16px 20px;margin-bottom:24px;">
      <p style="margin:0;font-size:14px;color:#374151;">Total Leads in Report: <strong>${totalLeads}</strong></p>
    </div>
    <p style="font-size:13px;color:#9ca3af;margin:0;">This report is automatically generated on the 2nd of every month. For any queries, please contact your Trustiva Setu relationship manager.</p>
  `)
}

export function attendanceStatusHtml(status: 'APPROVED' | 'REJECTED', emp: string, date: string, reason?: string) {
  const isApproved = status === 'APPROVED'
  return layout(`Attendance ${isApproved ? 'Approved' : 'Rejected'}`, `
    <div style="text-align:center;margin-bottom:20px;">
      <div style="display:inline-block;background:${isApproved ? '#dcfce7' : '#fee2e2'};border-radius:50%;width:60px;height:60px;line-height:60px;font-size:28px;">${isApproved ? '✓' : '✗'}</div>
    </div>
    <h2 style="margin:0 0 8px;color:#111827;text-align:center;">Attendance ${isApproved ? 'Approved' : 'Rejected'}</h2>
    <p style="color:#6b7280;font-size:14px;text-align:center;margin:0 0 20px;">Your attendance for <strong>${date}</strong> has been <strong>${status.toLowerCase()}</strong> by your manager.</p>
    ${!isApproved && reason ? `<div style="background:#fef2f2;border-radius:8px;padding:12px 16px;font-size:14px;color:#dc2626;margin-top:12px;"><strong>Reason:</strong> ${reason}</div>` : ''}
    <p style="font-size:13px;color:#9ca3af;text-align:center;margin:20px 0 0;">Please log in to ${BRAND.name} to view your attendance records.</p>
  `)
}
