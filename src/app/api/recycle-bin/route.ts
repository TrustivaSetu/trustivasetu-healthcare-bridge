import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const entityType = searchParams.get('entityType')
  const page = parseInt(searchParams.get('page') ?? '1')
  const pageSize = 20

  const where = entityType && entityType !== 'ALL' ? { entityType } : {}

  const [total, items] = await Promise.all([
    db.recycleBin.count({ where }),
    db.recycleBin.findMany({
      where,
      orderBy: { deletedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  // Enrich with deleter names
  const deleterIds = Array.from(new Set(items.map(i => i.deletedBy)))
  const deleters = await db.user.findMany({
    where: { id: { in: deleterIds } },
    select: { id: true, name: true, email: true },
  })
  const deleterMap = Object.fromEntries(deleters.map(d => [d.id, d]))

  const enriched = items.map((item: typeof items[0]) => ({
    ...item,
    deletedByUser: deleterMap[item.deletedBy] ?? null,
  }))

  return NextResponse.json({ data: enriched, total, page, pageSize })
}
