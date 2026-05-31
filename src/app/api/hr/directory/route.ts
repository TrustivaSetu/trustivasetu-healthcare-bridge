import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search') ?? ''
  const department = searchParams.get('department') ?? ''

  const users = await db.user.findMany({
    where: {
      isActive: true,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }),
      ...(department && { employeeProfile: { department: { equals: department, mode: 'insensitive' } } }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      createdAt: true,
      employeeProfile: {
        select: { designation: true, department: true, dateOfJoining: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ data: users })
}
