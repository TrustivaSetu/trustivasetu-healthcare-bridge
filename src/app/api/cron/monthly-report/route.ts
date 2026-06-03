import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { monthlyReportEmailHtml } from '@/lib/email'
import * as XLSX from 'xlsx'
import nodemailer from 'nodemailer'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

async function handler(req: NextRequest) {
  // Accept both Authorization: Bearer <secret> (Vercel cron) and x-cron-secret header (manual trigger)
  const authHeader = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-cron-secret')
  const provided = authHeader?.replace('Bearer ', '') ?? cronHeader ?? ''
  const expected = process.env.CRON_SECRET ?? ''

  // In dev or for Super Admin manual trigger, allow if the header matches or CRON_SECRET not set
  if (expected && provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const reportMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1
  const reportYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
  const monthName = MONTH_NAMES[reportMonth]

  const startDate = new Date(reportYear, reportMonth, 1)
  const endDate = new Date(reportYear, reportMonth + 1, 0, 23, 59, 59)

  // Handle manual trigger with optional clinicId param
  const { searchParams } = new URL(req.url)
  const singleClinicId = searchParams.get('clinicId')

  const clinics = await db.clinic.findMany({
    where: singleClinicId ? { id: singleClinicId } : { isActive: true },
    select: { id: true, name: true, email: true, reportEmails: true },
  })

  let sent = 0
  let failed = 0

  for (const clinic of clinics) {
    const recipients = [
      ...(clinic.email ? [clinic.email] : []),
      ...clinic.reportEmails,
    ].filter(Boolean)

    if (recipients.length === 0) continue

    const leads = await db.lead.findMany({
      where: {
        clinicId: clinic.id,
        applicationDate: { gte: startDate, lte: endDate },
      },
      include: { lender: { select: { name: true } } },
      orderBy: { applicationDate: 'asc' },
    })

    // Build Excel
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

    try {
      const transporter = createTransporter()
      if (transporter) {
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
        sent++
      }
    } catch (err) {
      console.error(`[monthly-report] Failed to send to ${clinic.name}:`, err)
      failed++
    }
  }

  return NextResponse.json({ success: true, sent, failed, month: monthName, year: reportYear })
}

function createTransporter() {
  if (!process.env.SMTP_HOST) return null
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
}

export { handler as GET, handler as POST }
