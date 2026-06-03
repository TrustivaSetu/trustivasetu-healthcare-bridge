import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'

function dateRange(tab: string): { gte?: Date; lte?: Date } {
  const now = new Date()
  if (tab === 'fortnight') {
    const gte = new Date(now)
    gte.setDate(gte.getDate() - 14)
    return { gte, lte: now }
  }
  if (tab === 'mtd') {
    const gte = new Date(now.getFullYear(), now.getMonth(), 1)
    return { gte, lte: now }
  }
  return {}
}

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'CLINIC_USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const clinicId = session.user.clinicIds[0]
  if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const tab = searchParams.get('tab') ?? 'overall'
  const range = dateRange(tab)

  const where = {
    clinicId,
    ...(range.gte || range.lte ? { applicationDate: range } : {}),
  }

  const [leads, disbursedLeads, foirLeads] = await Promise.all([
    db.lead.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    }),
    db.lead.aggregate({
      where: { ...where, status: 'DISBURSED' },
      _sum: { disbursedAmount: true },
      _count: { id: true },
    }),
    db.lead.findMany({
      where,
      select: { metadata: true },
    }),
  ])

  const statusMap: Record<string, number> = {}
  for (const g of leads) {
    statusMap[g.status] = g._count.id
  }

  const totalLeads = Object.values(statusMap).reduce((a, b) => a + b, 0)
  const approved = statusMap['APPROVED'] ?? 0
  const disbursed = statusMap['DISBURSED'] ?? 0
  const rejected = statusMap['REJECTED'] ?? 0
  const pending = statusMap['PENDING'] ?? 0
  const approvalRate = totalLeads > 0 ? ((approved + disbursed) / totalLeads) * 100 : 0

  // Extract CIBIL and FOIR from metadata
  let cibilSum = 0, cibilCount = 0, foirSum = 0, foirCount = 0
  for (const lead of foirLeads) {
    const meta = lead.metadata as Record<string, unknown> | null
    if (meta?.cibilScore && typeof meta.cibilScore === 'number') {
      cibilSum += meta.cibilScore
      cibilCount++
    }
    if (meta?.foir && typeof meta.foir === 'number') {
      foirSum += meta.foir
      foirCount++
    }
  }

  return NextResponse.json({
    data: {
      totalLeads,
      approved,
      disbursed,
      rejected,
      pending,
      totalDisbursalAmount: disbursedLeads._sum.disbursedAmount ?? 0,
      approvalRate: Math.round(approvalRate * 10) / 10,
      avgCibil: cibilCount > 0 ? Math.round(cibilSum / cibilCount) : null,
      avgFoir: foirCount > 0 ? Math.round((foirSum / foirCount) * 10) / 10 : null,
    },
  })
}
