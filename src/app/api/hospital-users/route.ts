import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''

  const where: Record<string, unknown> = { role: 'CLINIC_USER' }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { clinicAssignments: { some: { clinic: { name: { contains: search, mode: 'insensitive' } } } } },
    ]
  }

  const users = await db.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true,
      clinicAssignments: {
        select: { clinic: { select: { id: true, name: true, email: true } } },
        take: 1,
      },
      tabSessions: {
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const data = users.map(u => ({
    id: u.id,
    email: u.email,
    name: u.name,
    isActive: u.isActive,
    mustChangePassword: u.mustChangePassword,
    createdAt: u.createdAt,
    lastLoginAt: u.tabSessions[0]?.createdAt ?? null,
    clinic: u.clinicAssignments[0]?.clinic ?? null,
  }))

  return NextResponse.json({ data })
}
