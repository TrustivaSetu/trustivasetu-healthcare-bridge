import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendEmail, celebrationEmailHtml } from '@/lib/email'

function getISTToday() {
  const now = new Date()
  const ist = new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000)
  return { month: ist.getUTCMonth() + 1, day: ist.getUTCDate(), year: ist.getUTCFullYear() }
}

function completedYears(storedDate: Date, currentYear: number): number {
  return currentYear - new Date(storedDate).getUTCFullYear()
}

async function handler(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronHeader = req.headers.get('x-cron-secret')
  const provided = authHeader?.replace('Bearer ', '') ?? cronHeader ?? ''
  const expected = process.env.CRON_SECRET ?? ''
  if (expected && provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { month, day, year } = getISTToday()

  const profiles = await db.employeeProfile.findMany({
    where: { user: { isActive: true } },
    select: {
      userId: true,
      dateOfBirth: true,
      dateOfJoining: true,
      marriageAnniversary: true,
      user: { select: { name: true, email: true } },
    },
  })

  const results: { type: string; name: string; email: string; status: string }[] = []

  for (const p of profiles) {
    const { user } = p

    const checks: { field: Date | null; type: 'birthday' | 'work_anniversary' | 'marriage_anniversary' }[] = [
      { field: p.dateOfBirth, type: 'birthday' },
      { field: p.dateOfJoining, type: 'work_anniversary' },
      { field: p.marriageAnniversary, type: 'marriage_anniversary' },
    ]

    for (const { field, type } of checks) {
      if (!field) continue
      const d = new Date(field)
      if (d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) continue

      const yearsCount = type !== 'birthday' ? completedYears(field, year) : undefined

      try {
        await sendEmail({
          to: user.email,
          subject: type === 'birthday'
            ? `Happy Birthday, ${user.name}! 🎂`
            : type === 'work_anniversary'
            ? `Happy Work Anniversary, ${user.name}! 🏆`
            : `Happy Marriage Anniversary, ${user.name}! 💍`,
          html: celebrationEmailHtml({ name: user.name, type, yearsCount }),
          template: 'celebration',
        })
        results.push({ type, name: user.name, email: user.email, status: 'sent' })
      } catch {
        results.push({ type, name: user.name, email: user.email, status: 'failed' })
      }
    }
  }

  return NextResponse.json({ success: true, date: `${year}-${month}-${day}`, sent: results.filter(r => r.status === 'sent').length, failed: results.filter(r => r.status === 'failed').length, results })
}

export { handler as GET, handler as POST }
