import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))

  const holidays = await db.holiday.findMany({
    where: {
      date: {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      },
    },
    orderBy: { date: 'asc' },
  })

  return NextResponse.json({ data: holidays })
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = z.object({ name: z.string().min(1), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })

  const holiday = await db.holiday.create({
    data: {
      name: parsed.data.name,
      date: new Date(parsed.data.date + 'T00:00:00.000Z'),
      createdById: session.user.id,
    },
  })
  return NextResponse.json({ data: holiday }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'ADMIN')
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

  await db.holiday.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
