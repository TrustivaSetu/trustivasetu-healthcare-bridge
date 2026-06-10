import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const createSchema = z.object({
  type: z.enum(['PL', 'CL', 'MEDICAL', 'UNPLANNED']),
  fromDate: z.string(),
  toDate: z.string(),
  reason: z.string().min(3),
})

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const role = session.user.role as string
  const isManager = ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER'].includes(role)
  const pending = searchParams.get('pending') === 'true'
  const all = searchParams.get('all') === '1'

  const where: Record<string, any> = {}

  if (all && isManager) {
    // show all for admin/manager
  } else if (pending && isManager) {
    where.status = 'PENDING'
  } else {
    where.userId = session.user.id
  }

  const leaves = await db.leaveRequest.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return NextResponse.json({ data: leaves })
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const { type, fromDate, toDate, reason } = parsed.data

  if (toDate < fromDate) {
    return NextResponse.json({ error: 'End date must be on or after start date' }, { status: 400 })
  }

  const leave = await db.leaveRequest.create({
    data: {
      userId: session.user.id,
      type,
      fromDate: new Date(fromDate),
      toDate: new Date(toDate),
      reason,
      status: 'PENDING',
    },
    include: { user: { select: { id: true, name: true } } },
  })

  await db.auditLog.create({
    data: { userId: session.user.id, action: 'CREATE', entity: 'LeaveRequest', entityId: leave.id },
  })

  return NextResponse.json({ data: leave }, { status: 201 })
}
