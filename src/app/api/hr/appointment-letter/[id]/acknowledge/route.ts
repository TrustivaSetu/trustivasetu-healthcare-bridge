import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { COMPANY, ACK_EMAIL_RECIPIENTS, buildAcknowledgementEmailHtml } from '@/lib/hr/appointment-letter'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const letter = await db.appointmentLetter.findUnique({
    where: { id: params.id },
    include: { user: { select: { id: true, name: true, email: true } } },
  })

  if (!letter) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (letter.userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (letter.status === 'ACKNOWLEDGED') return NextResponse.json({ error: 'Already acknowledged' }, { status: 400 })

  const acknowledgedAt = new Date()
  const updated = await db.appointmentLetter.update({
    where: { id: params.id },
    data: { status: 'ACKNOWLEDGED', acknowledgedAt },
  })

  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://lms.trustivasetu.com'
  const portalUrl = `${baseUrl}/hr/appointment-letter/${params.id}`

  const subject = `Appointment Letter Acknowledged - ${letter.employeeName} - ${letter.designation ?? 'Employee'}`

  const html = buildAcknowledgementEmailHtml({
    employeeName: letter.employeeName,
    designation: letter.designation,
    letterNumber: letter.letterNumber,
    acknowledgedAt,
    portalUrl,
    salaryBreakdown: letter.salaryBreakdown as Record<string, number> | null,
    grossSalary: letter.grossSalary,
  })

  // Send to ALL recipients simultaneously:
  // 1. Employee's own email
  // 2. admin@trustivasetu.com
  // 3. abhishek.kashyap@trustivasetu.com
  // 4. ajit.yadav@trustivasetu.com
  const allRecipients = [letter.user.email, ...ACK_EMAIL_RECIPIENTS]

  // Deduplicate in case employee email matches one of the fixed recipients
  const uniqueRecipients = allRecipients.filter((v, i, a) => a.indexOf(v) === i)

  await sendEmail({
    to: uniqueRecipients,
    subject,
    html,
  })

  return NextResponse.json({ data: updated })
}
