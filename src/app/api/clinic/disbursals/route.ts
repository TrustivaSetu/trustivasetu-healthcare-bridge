import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'CLINIC_USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const clinicId = session.user.clinicIds[0]
  if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') ?? '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '20'), 100)
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  const where: Record<string, unknown> = { clinicId, status: 'DISBURSED' }
  if (dateFrom || dateTo) {
    where.disbursalDate = {}
    if (dateFrom) (where.disbursalDate as Record<string, unknown>).gte = new Date(dateFrom)
    if (dateTo) (where.disbursalDate as Record<string, unknown>).lte = new Date(dateTo + 'T23:59:59')
  }

  const [total, disbursals, aggregate] = await Promise.all([
    db.lead.count({ where }),
    db.lead.findMany({
      where,
      include: { lender: { select: { id: true, name: true } } },
      orderBy: { disbursalDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.lead.aggregate({
      where,
      _sum: { disbursedAmount: true },
    }),
  ])

  return NextResponse.json({
    data: disbursals,
    total,
    page,
    pageSize,
    totalAmount: aggregate._sum.disbursedAmount ?? 0,
  })
}
