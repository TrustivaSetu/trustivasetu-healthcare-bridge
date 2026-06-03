import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { monthlyReportEmailHtml } from '@/lib/email'
import * as XLSX from 'xlsx'
import nodemailer from 'nodemailer'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const clinic = await db.clinic.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, email: true, reportEmails: true },
  })
  if (!clinic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const now = new Date()
  const reportMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1
  const reportYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const monthName = MONTH_NAMES[reportMonth]

  const startDate = new Date(reportYear, reportMonth, 1)
  const endDate = new Date(reportYear, reportMonth + 1, 0, 23, 59, 59)

  const recipients = [
    ...(clinic.email ? [clinic.email] : []),
    ...clinic.reportEmails,
  ].filter(Boolean)

  if (recipients.length === 0) {
    return NextResponse.json({ error: 'No email configured for this clinic', sent: 0 }, { status: 400 })
  }

  const leads = await db.lead.findMany({
    where: { clinicId: clinic.id, applicationDate: { gte: startDate, lte: endDate } },
    include: { lender: { select: { name: true } } },
    orderBy: { applicationDate: 'asc' },
  })

  const rows = leads.map(l => ({
    'Patient Name': l.applicantName,
    'Phone': l.phone ?? '',
    'Applied Amount': l.amount,
    'Approved Amount': l.approvedAmount ?? '',
    'Disbursed Amount': l.disbursedAmount ?? '',
    'UTR Number': l.utrNumber ?? '',
    'Lender Name': l.lender?.name ?? '',
    'Status': l.status,
    'Application Date': l.applicationDate.toLocaleDateString('en-IN'),
  }))

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  XLSX.utils.book_append_sheet(wb, ws, `${monthName} ${reportYear}`)
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  if (!process.env.SMTP_HOST) {
    return NextResponse.json({ error: 'SMTP not configured', sent: 0 }, { status: 400 })
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })

  await transporter.sendMail({
    from: process.env.FROM_EMAIL ?? '"Trustiva Setu LMS" <noreply@trustivasetu.com>',
    to: recipients.join(', '),
    subject: `Monthly Lead Report — ${clinic.name} — ${monthName} ${reportYear}`,
    html: monthlyReportEmailHtml({ clinicName: clinic.name, month: monthName, year: reportYear, totalLeads: leads.length }),
    attachments: [{
      filename: `${clinic.name}-leads-${monthName}-${reportYear}.xlsx`,
      content: buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }],
  })

  await db.auditLog.create({
    data: { userId: session.user.id, action: 'CREATE', entity: 'MonthlyReport', entityId: params.id, details: `Manual report sent for ${monthName} ${reportYear}` },
  })

  return NextResponse.json({ success: true, sent: 1 })
}
