import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { buildClinicFilter } from '@/lib/permissions'

/** Fallback commission rate (%) when a lender has no agreed rate on file. */
const DEFAULT_RATE_PCT = 4

/**
 * GET /api/revenue/hospital-revenue
 * Estimated commission revenue per hospital (channel partner), derived from
 * disbursed loan volume × the agreed lender rate. Region/clinic scoped.
 */
export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'CLINIC_USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { role, regionIds, clinicIds } = session.user
  const clinicFilter = buildClinicFilter(role, regionIds, clinicIds)

  // Resolve the clinics this user may see.
  const clinics = await db.clinic.findMany({
    where: { ...clinicFilter },
    select: { id: true, name: true },
  })
  const clinicMap = new Map(clinics.map(c => [c.id, c.name]))
  const clinicIdList = clinics.map(c => c.id)

  // Latest agreed rate per lender (effectiveFrom desc → first wins).
  const rates = await db.lenderRate.findMany({ orderBy: { effectiveFrom: 'desc' } })
  const rateByLender = new Map<string, number>()
  for (const r of rates) if (!rateByLender.has(r.lenderId)) rateByLender.set(r.lenderId, r.agreedRatePct)
  const blendedRate = rateByLender.size
    ? [...rateByLender.values()].reduce((a, b) => a + b, 0) / rateByLender.size
    : DEFAULT_RATE_PCT

  // Aggregate disbursed volume per clinic × lender in a single grouped query.
  const groups = await db.lead.groupBy({
    by: ['clinicId', 'lenderId'],
    where: { status: 'DISBURSED', clinicId: { in: clinicIdList } },
    _sum: { disbursedAmount: true },
    _count: { _all: true },
  })

  const byClinic = new Map<string, { disbursed: number; leads: number; revenue: number }>()
  let totalDisbursed = 0
  let totalRevenue = 0
  let totalLeads = 0

  for (const g of groups) {
    const disbursed = g._sum.disbursedAmount ?? 0
    const ratePct = (g.lenderId && rateByLender.get(g.lenderId)) || blendedRate
    const revenue = (disbursed * ratePct) / 100
    const cur = byClinic.get(g.clinicId) ?? { disbursed: 0, leads: 0, revenue: 0 }
    cur.disbursed += disbursed
    cur.leads += g._count._all
    cur.revenue += revenue
    byClinic.set(g.clinicId, cur)
    totalDisbursed += disbursed
    totalRevenue += revenue
    totalLeads += g._count._all
  }

  const rows = [...byClinic.entries()]
    .map(([clinicId, v]) => ({
      clinicId,
      clinicName: clinicMap.get(clinicId) ?? 'Unknown',
      disbursedAmount: Math.round(v.disbursed),
      leadCount: v.leads,
      estimatedRevenue: Math.round(v.revenue),
      effectiveRatePct: v.disbursed ? Number(((v.revenue / v.disbursed) * 100).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.estimatedRevenue - a.estimatedRevenue)

  return NextResponse.json({
    data: rows,
    totals: {
      disbursedAmount: Math.round(totalDisbursed),
      leadCount: totalLeads,
      estimatedRevenue: Math.round(totalRevenue),
      blendedRatePct: Number(blendedRate.toFixed(2)),
      hospitalCount: rows.length,
    },
  })
}
