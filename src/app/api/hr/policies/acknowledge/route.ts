import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { generateAppointmentLetter } from '@/lib/hr/appointment-letter'

export async function POST() {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await db.employeeProfile.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, policyAcknowledgedAt: new Date() },
    update: { policyAcknowledgedAt: new Date() },
  })

  // Auto-generate appointment letter if salary is configured
  const letterResult = await generateAppointmentLetter(session.user.id)

  return NextResponse.json({
    success: true,
    acknowledgedAt: new Date(),
    letter: 'letter' in letterResult ? letterResult.letter : null,
    letterAlreadyExists: 'alreadyExists' in letterResult,
    noSalary: 'noSalary' in letterResult,
  })
}

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const all = searchParams.get('all') === '1'
  const isAdmin = session.user.role === 'SUPER_ADMIN' || session.user.role === 'ADMIN'

  if (all && isAdmin) {
    const users = await db.user.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, email: true, role: true,
        employeeProfile: { select: { designation: true, policyAcknowledgedAt: true } },
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json({ data: users })
  }

  const profile = await db.employeeProfile.findUnique({
    where: { userId: session.user.id },
    select: { policyAcknowledgedAt: true },
  })
  return NextResponse.json({ policyAcknowledgedAt: profile?.policyAcknowledgedAt ?? null })
}
