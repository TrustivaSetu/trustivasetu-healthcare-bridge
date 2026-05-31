import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { buildClinicFilter } from '@/lib/permissions'
import { startOfMonth, endOfMonth, subMonths, getDaysInMonth, getDate, format } from 'date-fns'

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const regionId = searchParams.get('regionId')
  const clinicId = searchParams.get('clinicId')
  const lenderId = searchParams.get('lenderId')
  const rmId = searchParams.get('rmId')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')

  const { role, regionIds, clinicIds } = session.user
  const now = new Date()

  // Date range for lead queries
  const fromDate = dateFrom ? new Date(dateFrom) : new Date(now.getFullYear(), now.getMonth(), 1)
  const toDate = dateTo ? new Date(dateTo + 'T23:59:59') : now

  // Build clinic filter from role + extra filters
  const clinicFilter: Record<string, unknown> = buildClinicFilter(role, regionIds, clinicIds)
  if (regionId) clinicFilter.regionId = regionId
  if (clinicId) { clinicFilter.id = clinicId; delete clinicFilter.regionId }
  if (rmId) clinicFilter.assignedRMId = rmId

  const clinics = await db.clinic.findMany({ where: { ...clinicFilter, isActive: true }, select: { id: true } })
  const clinicIdList = clinics.map(c => c.id)

  if (clinicIdList.length === 0) {
    return NextResponse.json(emptyMetrics())
  }

  const baseWhere: Record<string, unknown> = {
    clinicId: { in: clinicIdList },
    applicationDate: { gte: fromDate, lte: toDate },
  }
  if (lenderId) baseWhere.lenderId = lenderId

  const [totalLeads, approvedLeads, disbursedLeads, totalClinics, leadAgg, approvedAgg, disbursedAgg] =
    await Promise.all([
      db.lead.count({ where: baseWhere }),
      db.lead.count({ where: { ...baseWhere, status: { in: ['APPROVED', 'DISBURSED'] } } }),
      db.lead.count({ where: { ...baseWhere, status: 'DISBURSED' } }),
      db.clinic.count({ where: { ...clinicFilter, isActive: true } }),
      db.lead.aggregate({ _sum: { amount: true }, where: baseWhere }),
      db.lead.aggregate({ _sum: { approvedAmount: true }, where: { ...baseWhere, status: { in: ['APPROVED', 'DISBURSED'] } } }),
      db.lead.aggregate({ _sum: { disbursedAmount: true }, where: { ...baseWhere, status: 'DISBURSED' } }),
    ])

  // Lender-wise stats
  const lenderGroups = await db.lead.groupBy({
    by: ['lenderId'],
    where: { ...baseWhere, lenderId: { not: null } },
    _count: { id: true },
  })
  const lenderIds = lenderGroups.map(g => g.lenderId).filter(Boolean) as string[]
  const lenderList = await db.lender.findMany({ where: { id: { in: lenderIds } } })
  const lenderMap = Object.fromEntries(lenderList.map(l => [l.id, l.name]))

  const lenderWise = await Promise.all(
    lenderGroups.map(async g => {
      if (!g.lenderId) return null
      const approved = await db.lead.count({
        where: { ...baseWhere, lenderId: g.lenderId, status: { in: ['APPROVED', 'DISBURSED'] } }
      })
      return {
        lenderId: g.lenderId,
        lenderName: lenderMap[g.lenderId] ?? 'Unknown',
        totalLeads: g._count.id,
        approved,
        approvalRate: g._count.id > 0 ? (approved / g._count.id) * 100 : 0,
      }
    })
  )

  // Monthly trend (6 months)
  const monthlyTrend = []
  for (let i = 5; i >= 0; i--) {
    const mo = subMonths(now, i)
    const mStart = startOfMonth(mo), mEnd = endOfMonth(mo)
    const mWhere: Record<string, unknown> = { clinicId: { in: clinicIdList }, applicationDate: { gte: mStart, lte: mEnd } }
    if (lenderId) mWhere.lenderId = lenderId

    const [ml, ma, md, mlv, mav, mdv] = await Promise.all([
      db.lead.count({ where: mWhere }),
      db.lead.count({ where: { ...mWhere, status: { in: ['APPROVED', 'DISBURSED'] } } }),
      db.lead.count({ where: { ...mWhere, status: 'DISBURSED' } }),
      db.lead.aggregate({ _sum: { amount: true }, where: mWhere }),
      db.lead.aggregate({ _sum: { approvedAmount: true }, where: { ...mWhere, status: { in: ['APPROVED', 'DISBURSED'] } } }),
      db.lead.aggregate({ _sum: { disbursedAmount: true }, where: { ...mWhere, status: 'DISBURSED' } }),
    ])
    monthlyTrend.push({
      month: format(mo, 'MMM yy'),
      leads: ml, approved: ma, disbursed: md,
      leadValue: mlv._sum.amount ?? 0,
      approvedValue: mav._sum.approvedAmount ?? 0,
      disbursedValue: mdv._sum.disbursedAmount ?? 0,
    })
  }

  // Target & run rate
  const curMonth = now.getMonth() + 1, curYear = now.getFullYear()
  const daysElapsed = getDate(now), totalDays = getDaysInMonth(now)

  const targetFilter: Record<string, unknown> = { year: curYear, month: curMonth }
  if (role === 'REGIONAL_MANAGER' && regionIds.length > 0) targetFilter.regionId = { in: regionIds }
  else if (role === 'TEAM_MEMBER') targetFilter.userId = session.user.id

  const targets = await db.target.findMany({ where: targetFilter })
  const leadsTarget = targets.reduce((s, t) => s + t.leadsTarget, 0)
  const disbursalTarget = targets.reduce((s, t) => s + t.disbursalTarget, 0)

  const mtdLeads = await db.lead.count({
    where: { clinicId: { in: clinicIdList }, applicationDate: { gte: new Date(curYear, curMonth - 1, 1), lte: now } }
  })
  const mtdDisbAgg = await db.lead.aggregate({
    _sum: { disbursedAmount: true },
    where: { clinicId: { in: clinicIdList }, status: 'DISBURSED', disbursalDate: { gte: new Date(curYear, curMonth - 1, 1), lte: now } }
  })
  const mtdDisb = mtdDisbAgg._sum.disbursedAmount ?? 0

  const prev = subMonths(now, 1)
  const [prevLeads, prevDisbAgg] = await Promise.all([
    db.lead.count({ where: { clinicId: { in: clinicIdList }, applicationDate: { gte: startOfMonth(prev), lte: endOfMonth(prev) } } }),
    db.lead.aggregate({ _sum: { disbursedAmount: true }, where: { clinicId: { in: clinicIdList }, status: 'DISBURSED', disbursalDate: { gte: startOfMonth(prev), lte: endOfMonth(prev) } } }),
  ])
  const prevDisb = prevDisbAgg._sum.disbursedAmount ?? 0

  const leadsGrowth = prevLeads > 0 ? ((mtdLeads - prevLeads) / prevLeads) * 100 : (mtdLeads > 0 ? 100 : 0)
  const disbGrowth = prevDisb > 0 ? ((mtdDisb - prevDisb) / prevDisb) * 100 : (mtdDisb > 0 ? 100 : 0)
  const rem = totalDays - daysElapsed

  return NextResponse.json({
    totalLeads,
    totalApproved: approvedLeads,
    totalDisbursed: disbursedLeads,
    totalClinics,
    totalLeadValue: leadAgg._sum.amount ?? 0,
    totalApprovedValue: approvedAgg._sum.approvedAmount ?? 0,
    totalDisbursedValue: disbursedAgg._sum.disbursedAmount ?? 0,
    approvalRate: totalLeads > 0 ? (approvedLeads / totalLeads) * 100 : 0,
    disbursalRate: totalLeads > 0 ? (disbursedLeads / totalLeads) * 100 : 0,
    lenderWise: lenderWise.filter(Boolean),
    monthlyTrend,
    target: {
      leadsTarget, disbursalTarget,
      leadsAchieved: mtdLeads, disbursalAchieved: mtdDisb,
      leadsGrowth, disbursalGrowth: disbGrowth,
      currentLeadRunRate: daysElapsed > 0 ? (mtdLeads / daysElapsed) * totalDays : 0,
      currentDisbursalRunRate: daysElapsed > 0 ? (mtdDisb / daysElapsed) * totalDays : 0,
      requiredLeadRunRate: rem > 0 ? (leadsTarget - mtdLeads) / rem : 0,
      requiredDisbursalRunRate: rem > 0 ? (disbursalTarget - mtdDisb) / rem : 0,
    },
  })
}

function emptyMetrics() {
  return {
    totalLeads: 0, totalApproved: 0, totalDisbursed: 0, totalClinics: 0,
    totalLeadValue: 0, totalApprovedValue: 0, totalDisbursedValue: 0,
    approvalRate: 0, disbursalRate: 0, lenderWise: [], monthlyTrend: [],
    target: { leadsTarget: 0, disbursalTarget: 0, leadsAchieved: 0, disbursalAchieved: 0, leadsGrowth: 0, disbursalGrowth: 0, currentLeadRunRate: 0, currentDisbursalRunRate: 0, requiredLeadRunRate: 0, requiredDisbursalRunRate: 0 },
  }
}
