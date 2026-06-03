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
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const page = parseInt(searchParams.get('page') ?? '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '20'), 100)

  const where: Record<string, unknown> = { clinicId }
  if (status) where.status = status
  if (search) where.applicantName = { contains: search, mode: 'insensitive' }

  const [total, leads] = await Promise.all([
    db.lead.count({ where }),
    db.lead.findMany({
      where,
      include: {
        lender: { select: { id: true, name: true } },
      },
      orderBy: { applicationDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return NextResponse.json({ data: leads, total, page, pageSize })
}
