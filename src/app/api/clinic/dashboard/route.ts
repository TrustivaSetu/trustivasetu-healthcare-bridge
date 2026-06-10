import { NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'

export async function GET() {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'CLINIC_USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const clinicId = session.user.clinicIds[0]
  if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [statusGroups, todayCount, monthCount] = await Promise.all([
    db.lead.groupBy({ by: ['status'], where: { clinicId }, _count: { id: true } }),
    db.lead.count({ where: { clinicId, applicationDate: { gte: todayStart } } }),
    db.lead.count({ where: { clinicId, applicationDate: { gte: monthStart } } }),
  ])

  const statusMap: Record<string, number> = {}
  for (const g of statusGroups) statusMap[g.status] = g._count.id

  const totalLeads = Object.values(statusMap).reduce((a, b) => a + b, 0)
  const approved = statusMap['APPROVED'] ?? 0
  const disbursed = statusMap['DISBURSED'] ?? 0
  const rejected = statusMap['REJECTED'] ?? 0
  // APPROVED status = approved but not yet disbursed
  const pendingDisbursal = approved

  return NextResponse.json({
    data: {
      totalLeads,
      todayLeads: todayCount,
      monthLeads: monthCount,
      approved,
      disbursed,
      rejected,
      pendingDisbursal,
    },
  })
}
