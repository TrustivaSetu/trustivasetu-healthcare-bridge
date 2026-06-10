import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email'
import { COMPANY, ACK_EMAIL_RECIPIENTS, buildAcknowledgementEmailHtml, buildLetterReadyEmailHtml } from '@/lib/hr/appointment-letter'

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const isAdmin = session.user.role === 'SUPER_ADMIN' || session.user.role === 'ADMIN'
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const letter = await db.appointmentLetter.findUnique({
    where: { id: params.id },
    include: { user: { select: { name: true, email: true } } },
  })
  if (!letter) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://lms.trustivasetu.com'
  const portalUrl = `${baseUrl}/hr/appointment-letter/${params.id}`

  if (letter.status === 'ACKNOWLEDGED' && letter.acknowledgedAt) {
    // Resend the full acknowledgement notification to all recipients
    const subject = `Appointment Letter Acknowledged - ${letter.employeeName} - ${letter.designation ?? 'Employee'}`
    const html = buildAcknowledgementEmailHtml({
      employeeName: letter.employeeName,
      designation: letter.designation,
      letterNumber: letter.letterNumber,
      acknowledgedAt: letter.acknowledgedAt,
      portalUrl,
      salaryBreakdown: letter.salaryBreakdown as Record<string, number> | null,
      grossSalary: letter.grossSalary,
    })
    const combined = [letter.user.email, ...ACK_EMAIL_RECIPIENTS]
    const allRecipients = combined.filter((v, i, a) => a.indexOf(v) === i)
    await sendEmail({ to: allRecipients, subject, html })
  } else {
    // Resend the "letter is ready" notification to employee only
    await sendEmail({
      to: letter.user.email,
      subject: `Your Appointment Letter is Ready — ${COMPANY.name}`,
      html: buildLetterReadyEmailHtml({
        employeeName: letter.user.name,
        letterNumber: letter.letterNumber,
        portalUrl,
      }),
    })
  }

  return NextResponse.json({ success: true })
}
