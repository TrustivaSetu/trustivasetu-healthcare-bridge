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
  const lenderId = searchParams.get('lenderId')
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : null
  const page = parseInt(searchParams.get('page') ?? '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '10'), 100)

  const where: Record<string, unknown> = { clinicId }
  if (status) where.status = status
  if (lenderId) where.lenderId = lenderId
  if (search) where.applicantName = { contains: search, mode: 'insensitive' }
  if (month && year && month >= 1 && month <= 12) {
    const monthStart = new Date(year, month - 1, 1)
    const monthEnd = new Date(year, month, 1)
    where.applicationDate = { gte: monthStart, lt: monthEnd }
  }

  const [total, leads] = await Promise.all([
    db.lead.count({ where }),
    db.lead.findMany({
      where,
      select: {
        id: true,
        applicantName: true,
        phone: true,
        amount: true,
        status: true,
        applicationDate: true,
        approvalDate: true,
        disbursalDate: true,
        approvedAmount: true,
        disbursedAmount: true,
        utrNumber: true,
        nachStatus: true,
        agreementSigned: true,
        treatmentName: true,
        treatmentCategory: true,
        remarks: true,
        rejectionReason: true,
        metadata: true,
        lender: { select: { id: true, name: true } },
      },
      orderBy: { applicationDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  return NextResponse.json({ data: leads, total, page, pageSize })
}
