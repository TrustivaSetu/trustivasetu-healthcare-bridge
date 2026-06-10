import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { calculateSalary } from '@/lib/hr/salary'
import { generateAppointmentLetter, buildLetterReadyEmailHtml } from '@/lib/hr/appointment-letter'
import { sendEmail } from '@/lib/email'
import { z } from 'zod'

function isAdmin(role: string) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN'
}

export async function GET(req: NextRequest, context: { params: Promise<{ userId: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const salary = await db.salaryStructure.findUnique({ where: { userId: params.userId } })
  if (!salary) return NextResponse.json({ data: null })

  return NextResponse.json({ data: { ...salary, components: calculateSalary(salary.grossSalary, salary.tds) } })
}

export async function PUT(req: NextRequest, context: { params: Promise<{ userId: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = z.object({ grossSalary: z.number().positive(), tds: z.number().min(0).optional() }).safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid salary data' }, { status: 400 })

  const { grossSalary, tds = 0 } = parsed.data
  const salary = await db.salaryStructure.upsert({
    where: { userId: params.userId },
    create: { userId: params.userId, grossSalary, tds },
    update: { grossSalary, tds },
  })

  await db.auditLog.create({
    data: { userId: session.user.id, action: 'UPDATE', entity: 'SalaryStructure', entityId: params.userId },
  })

  // Auto-generate appointment letter if the employee has already acknowledged HR policies
  // but doesn't yet have a letter (salary was added after acknowledgement).
  void (async () => {
    try {
      const employee = await db.user.findUnique({
        where: { id: params.userId },
        select: { email: true, name: true, employeeProfile: { select: { policyAcknowledgedAt: true } } },
      })

      if (!employee?.employeeProfile?.policyAcknowledgedAt) return // hasn't acknowledged policies yet

      const result = await generateAppointmentLetter(params.userId)

      if ('letter' in result && !('alreadyExists' in result) && result.letter) {
        // New letter generated — notify the employee
        const baseUrl = process.env.NEXTAUTH_URL ?? 'https://lms.trustivasetu.com'
        const portalUrl = `${baseUrl}/hr/appointment-letter/${result.letter.id}`

        await sendEmail({
          to: employee.email,
          subject: `Your Appointment Letter is Ready — ${COMPANY_NAME}`,
          html: buildLetterReadyEmailHtml({
            employeeName: employee.name,
            letterNumber: result.letter.letterNumber,
            portalUrl,
          }),
        })
      }
    } catch (e) {
      console.error('[Salary PUT] Letter auto-gen error:', e)
    }
  })()

  return NextResponse.json({ data: { ...salary, components: calculateSalary(grossSalary, tds) } })
}

const COMPANY_NAME = 'Trustivasetu'
