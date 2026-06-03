import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const itemSchema = z.object({
  date: z.string(),
  category: z.string(),
  description: z.string(),
  fromLocation: z.string().optional().nullable(),
  toLocation: z.string().optional().nullable(),
  distanceKm: z.number().optional().nullable(),
  amount: z.number(),
  billUrl: z.string().optional().nullable(),
  billName: z.string().optional().nullable(),
  clientName: z.string().optional().nullable(),
})

const createSchema = z.object({
  title: z.string().min(1),
  periodType: z.string().default('MONTHLY'),
  periodStart: z.string(),
  periodEnd: z.string(),
  notes: z.string().optional().nullable(),
  items: z.array(itemSchema).optional().default([]),
})

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const status = searchParams.get('status')
  const month = searchParams.get('month') // YYYY-MM
  const isAdmin = session.user.role === 'SUPER_ADMIN' || session.user.role === 'ADMIN'
  const isManager = session.user.role === 'REGIONAL_MANAGER'

  let whereUserId = session.user.id
  if (userId && (isAdmin || isManager)) whereUserId = userId
  else if (!userId && isAdmin && searchParams.get('all') === '1') {
    whereUserId = '' // admin sees all — no userId filter
  }

  const where: Record<string, unknown> = {}
  if (whereUserId) {
    where.userId = whereUserId
  } else if (isAdmin) {
    // admin with all=1 — no userId filter
  } else if (isManager) {
    // regional manager sees direct reports' expenses
    where.user = { reportingManagerId: session.user.id }
  } else {
    where.userId = session.user.id
  }

  if (status) where.status = status
  if (month) {
    const [y, m] = month.split('-').map(Number)
    where.periodStart = { gte: new Date(Date.UTC(y, m - 1, 1)) }
    where.periodEnd = { lt: new Date(Date.UTC(y, m, 1)) }
  }

  const expenses = await db.expense.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, employeeProfile: { select: { designation: true } } } },
      approvedBy: { select: { id: true, name: true } },
      items: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  return NextResponse.json({ data: expenses })
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })

  const { items, ...expData } = parsed.data
  const totalAmount = items.reduce((s, i) => s + i.amount, 0)

  const expense = await db.expense.create({
    data: {
      userId: session.user.id,
      ...expData,
      periodStart: new Date(expData.periodStart + 'T00:00:00.000Z'),
      periodEnd: new Date(expData.periodEnd + 'T00:00:00.000Z'),
      totalAmount,
      items: {
        create: items.map(item => ({
          ...item,
          date: new Date(item.date + 'T00:00:00.000Z'),
        })),
      },
    },
    include: { items: true },
  })

  return NextResponse.json({ data: expense }, { status: 201 })
}
