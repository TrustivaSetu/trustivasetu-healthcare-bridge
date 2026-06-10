import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const itemSchema = z.object({
  id: z.string().optional(),
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

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  periodType: z.string().optional(),
  periodStart: z.string().optional(),
  periodEnd: z.string().optional(),
  notes: z.string().optional().nullable(),
  items: z.array(itemSchema).optional(),
})

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const expense = await db.expense.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, name: true, email: true, reportingManagerId: true, employeeProfile: { select: { designation: true, photoUrl: true } } } },
      approvedBy: { select: { id: true, name: true } },
      items: { orderBy: { date: 'asc' } },
    },
  })
  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = session.user.role === 'SUPER_ADMIN' || session.user.role === 'ADMIN'
  const isSelf = expense.userId === session.user.id
  const isReportingManager = expense.user.reportingManagerId === session.user.id
  if (!isAdmin && !isSelf && !isReportingManager)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json({ data: expense })
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const expense = await db.expense.findUnique({ where: { id: params.id } })
  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = session.user.role === 'SUPER_ADMIN' || session.user.role === 'ADMIN'
  const isSelf = expense.userId === session.user.id
  if (!isAdmin && !isSelf) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Only DRAFT or REJECTED can be edited by employee
  if (!isAdmin && expense.status !== 'DRAFT' && expense.status !== 'REJECTED')
    return NextResponse.json({ error: 'Cannot edit a submitted or approved expense' }, { status: 400 })

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })

  const { items, ...rest } = parsed.data

  const updateData: Record<string, unknown> = { ...rest }
  if (rest.periodStart) updateData.periodStart = new Date(rest.periodStart + 'T00:00:00.000Z')
  if (rest.periodEnd) updateData.periodEnd = new Date(rest.periodEnd + 'T00:00:00.000Z')

  if (items !== undefined) {
    // Replace all items
    await db.expenseItem.deleteMany({ where: { expenseId: params.id } })
    const total = items.reduce((s, i) => s + i.amount, 0)
    updateData.totalAmount = total
    await db.expenseItem.createMany({
      data: items.map(item => ({
        expenseId: params.id,
        ...item,
        id: undefined,
        date: new Date(item.date + 'T00:00:00.000Z'),
      })),
    })
  }

  // If re-editing a rejected expense, reset to DRAFT
  if (expense.status === 'REJECTED' && !isAdmin) updateData.status = 'DRAFT'

  const updated = await db.expense.update({
    where: { id: params.id },
    data: updateData,
    include: { items: { orderBy: { date: 'asc' } } },
  })

  return NextResponse.json({ data: updated })
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const expense = await db.expense.findUnique({ where: { id: params.id } })
  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = session.user.role === 'SUPER_ADMIN' || session.user.role === 'ADMIN'
  if (!isAdmin && expense.userId !== session.user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!isAdmin && expense.status !== 'DRAFT')
    return NextResponse.json({ error: 'Only draft expenses can be deleted' }, { status: 400 })

  await db.expense.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
