import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { generateAppointmentLetter } from '@/lib/hr/appointment-letter'

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const status = searchParams.get('status')
  const isAdmin = session.user.role === 'SUPER_ADMIN' || session.user.role === 'ADMIN'

  const where: Record<string, unknown> = { isArchived: false }

  if (isAdmin && !userId) {
    // Admin sees all
  } else if (isAdmin && userId) {
    where.userId = userId
  } else {
    where.userId = session.user.id
  }

  if (status) where.status = status

  const letters = await db.appointmentLetter.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, employeeProfile: { select: { designation: true, department: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ data: letters })
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const isAdmin = session.user.role === 'SUPER_ADMIN' || session.user.role === 'ADMIN'

  const body = await req.json().catch(() => ({}))
  const targetUserId = isAdmin && body.userId ? body.userId : session.user.id

  const result = await generateAppointmentLetter(targetUserId)

  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  if ('noSalary' in result) return NextResponse.json({ noSalary: true, message: 'Salary not configured for this employee' }, { status: 200 })
  if ('alreadyExists' in result) return NextResponse.json({ data: result.letter, alreadyExists: true })

  return NextResponse.json({ data: result.letter }, { status: 201 })
}
