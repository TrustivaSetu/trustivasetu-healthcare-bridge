import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { buildClinicFilter } from '@/lib/permissions'

const DAY = 1000 * 60 * 60 * 24

type BucketKey = 'current' | 'watch' | 'review' | 'overdue'
const BUCKETS: { key: BucketKey; label: string; min: number; max: number; color: string }[] = [
  { key: 'current', label: 'Current (0–30d)',  min: 0,   max: 30,       color: '#16a34a' },
  { key: 'watch',   label: 'Watch (31–60d)',   min: 31,  max: 60,       color: '#65a30d' },
  { key: 'review',  label: 'Review (61–90d)',  min: 61,  max: 90,       color: '#d97706' },
  { key: 'overdue', label: 'Overdue (90d+)',   min: 91,  max: Infinity, color: '#dc2626' },
]

/**
 * GET /api/revenue/npa-tracker
 * Buckets disbursed loans by age (days since disbursal) into asset-quality
 * brackets. Region/clinic scoped. Returns bucket summaries + the overdue list.
 */
export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'CLINIC_USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { role, regionIds, clinicIds } = session.user
  const clinicFilter = buildClinicFilter(role, regionIds, clinicIds)
  const clinics = await db.clinic.findMany({ where: { ...clinicFilter }, select: { id: true, name: true } })
  const clinicMap = new Map(clinics.map(c => [c.id, c.name]))

  const leads = await db.lead.findMany({
    where: { status: 'DISBURSED', clinicId: { in: clinics.map(c => c.id) } },
    select: {
      id: true, leadNumber: true, applicantName: true, disbursedAmount: true,
      disbursalDate: true, applicationDate: true, clinicId: true, nachStatus: true,
    },
    orderBy: { disbursalDate: 'asc' },
  })

  const now = Date.now()
  const summary = BUCKETS.map(b => ({ ...b, count: 0, amount: 0 }))
  const overdue: Array<Record<string, unknown>> = []

  for (const l of leads) {
    const ref = (l.disbursalDate ?? l.applicationDate).getTime()
    const ageDays = Math.max(0, Math.floor((now - ref) / DAY))
    const idx = BUCKETS.findIndex(b => ageDays >= b.min && ageDays <= b.max)
    const bucket = idx >= 0 ? idx : BUCKETS.length - 1
    summary[bucket].count += 1
    summary[bucket].amount += l.disbursedAmount ?? 0

    if (BUCKETS[bucket].key === 'overdue' && overdue.length < 100) {
      overdue.push({
        id: l.id,
        leadNumber: l.leadNumber,
        applicantName: l.applicantName,
        clinicName: clinicMap.get(l.clinicId) ?? 'Unknown',
        disbursedAmount: Math.round(l.disbursedAmount ?? 0),
        ageDays,
        nachStatus: l.nachStatus,
      })
    }
  }

  const totalAmount = summary.reduce((a, b) => a + b.amount, 0)
  const totalCount = summary.reduce((a, b) => a + b.count, 0)
  const overdueAmount = summary.find(s => s.key === 'overdue')?.amount ?? 0
  const npaRatio = totalAmount ? Number(((overdueAmount / totalAmount) * 100).toFixed(2)) : 0

  return NextResponse.json({
    data: summary.map(s => ({ ...s, amount: Math.round(s.amount) })),
    overdue,
    totals: { totalAmount: Math.round(totalAmount), totalCount, overdueAmount: Math.round(overdueAmount), npaRatio },
  })
}
