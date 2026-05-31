import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { buildClinicFilter } from '@/lib/permissions'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? 'monthly'
  const months = parseInt(searchParams.get('months') ?? '6')
  const regionId = searchParams.get('regionId')

  const { role, regionIds, clinicIds } = session.user

  let clinicFilter = buildClinicFilter(role, regionIds, clinicIds)
  if (regionId) clinicFilter = { ...clinicFilter, regionId }

  const clinics = await db.clinic.findMany({ where: { ...clinicFilter, isActive: true }, select: { id: true, name: true, regionId: true, assignedRMId: true, assignedRM: { select: { id: true, name: true } }, region: { select: { id: true, name: true } } } })
  const clinicIdList = clinics.map(c => c.id)
  const now = new Date()

  if (type === 'monthly') {
    const data = []
    for (let i = months - 1; i >= 0; i--) {
      const mo = subMonths(now, i)
      const start = startOfMonth(mo), end = endOfMonth(mo)
      const where = { clinicId: { in: clinicIdList }, applicationDate: { gte: start, lte: end } }

      const [totalLeads, approved, disbursed, leadAgg, approvedAgg, disbursedAgg] = await Promise.all([
        db.lead.count({ where }),
        db.lead.count({ where: { ...where, status: { in: ['APPROVED', 'DISBURSED'] } } }),
        db.lead.count({ where: { ...where, status: 'DISBURSED' } }),
        db.lead.aggregate({ _sum: { amount: true }, where }),
        db.lead.aggregate({ _sum: { approvedAmount: true }, where: { ...where, status: { in: ['APPROVED', 'DISBURSED'] } } }),
        db.lead.aggregate({ _sum: { disbursedAmount: true }, where: { ...where, status: 'DISBURSED' } }),
      ])

      data.push({
        period: format(mo, 'MMMM yyyy'),
        month: format(mo, 'yyyy-MM'),
        totalLeads, approved, disbursed,
        leadValue: leadAgg._sum.amount ?? 0,
        approvedValue: approvedAgg._sum.approvedAmount ?? 0,
        disbursedValue: disbursedAgg._sum.disbursedAmount ?? 0,
        approvalRate: totalLeads > 0 ? (approved / totalLeads) * 100 : 0,
        disbursalRate: totalLeads > 0 ? (disbursed / totalLeads) * 100 : 0,
      })
    }
    return NextResponse.json({ data })
  }

  if (type === 'region') {
    const regions = await db.region.findMany({ where: { isActive: true } })
    const data = await Promise.all(regions.map(async r => {
      const rClinics = clinics.filter(c => c.regionId === r.id)
      const rIds = rClinics.map(c => c.id)
      if (rIds.length === 0) return { ...r, totalLeads: 0, approved: 0, disbursed: 0, leadValue: 0, disbursedValue: 0 }
      const where = { clinicId: { in: rIds } }
      const [tl, ap, di, lv, dv] = await Promise.all([
        db.lead.count({ where }),
        db.lead.count({ where: { ...where, status: { in: ['APPROVED', 'DISBURSED'] } } }),
        db.lead.count({ where: { ...where, status: 'DISBURSED' } }),
        db.lead.aggregate({ _sum: { amount: true }, where }),
        db.lead.aggregate({ _sum: { disbursedAmount: true }, where: { ...where, status: 'DISBURSED' } }),
      ])
      return { ...r, totalLeads: tl, approved: ap, disbursed: di, leadValue: lv._sum.amount ?? 0, disbursedValue: dv._sum.disbursedAmount ?? 0, approvalRate: tl > 0 ? (ap / tl) * 100 : 0 }
    }))
    return NextResponse.json({ data })
  }

  if (type === 'rm') {
    const rms = await db.user.findMany({ where: { role: { in: ['REGIONAL_MANAGER', 'TEAM_MEMBER'] }, isActive: true }, select: { id: true, name: true, role: true } })
    const data = await Promise.all(rms.map(async rm => {
      const rmClinics = clinics.filter(c => c.assignedRMId === rm.id)
      const rmClinicIds = rmClinics.map(c => c.id)
      if (rmClinicIds.length === 0) {
        return { id: rm.id, name: rm.name, role: rm.role, totalLeads: 0, approved: 0, disbursed: 0, leadValue: 0, disbursedValue: 0, approvalRate: 0 }
      }
      const where = { clinicId: { in: rmClinicIds } }
      const [tl, ap, di, lv, dv] = await Promise.all([
        db.lead.count({ where }),
        db.lead.count({ where: { ...where, status: { in: ['APPROVED', 'DISBURSED'] } } }),
        db.lead.count({ where: { ...where, status: 'DISBURSED' } }),
        db.lead.aggregate({ _sum: { amount: true }, where }),
        db.lead.aggregate({ _sum: { disbursedAmount: true }, where: { ...where, status: 'DISBURSED' } }),
      ])
      return { id: rm.id, name: rm.name, role: rm.role, totalLeads: tl, approved: ap, disbursed: di, leadValue: lv._sum.amount ?? 0, disbursedValue: dv._sum.disbursedAmount ?? 0, approvalRate: tl > 0 ? (ap / tl) * 100 : 0 }
    }))
    return NextResponse.json({ data: data.filter(d => d.totalLeads > 0) })
  }

  if (type === 'lender') {
    const lenders = await db.lender.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
    const data = await Promise.all(lenders.map(async lender => {
      const where = { clinicId: { in: clinicIdList }, lenderId: lender.id }
      const [tl, ap, di, av, dv] = await Promise.all([
        db.lead.count({ where }),
        db.lead.count({ where: { ...where, status: { in: ['APPROVED', 'DISBURSED'] } } }),
        db.lead.count({ where: { ...where, status: 'DISBURSED' } }),
        db.lead.aggregate({ _sum: { approvedAmount: true }, where: { ...where, status: { in: ['APPROVED', 'DISBURSED'] } } }),
        db.lead.aggregate({ _sum: { disbursedAmount: true }, where: { ...where, status: 'DISBURSED' } }),
      ])
      return {
        id: lender.id,
        name: lender.name,
        code: lender.code,
        totalLeads: tl,
        approved: ap,
        disbursed: di,
        approvedValue: av._sum.approvedAmount ?? 0,
        disbursedValue: dv._sum.disbursedAmount ?? 0,
        approvalRate: tl > 0 ? (ap / tl) * 100 : 0,
        disbursalRate: tl > 0 ? (di / tl) * 100 : 0,
      }
    }))
    return NextResponse.json({ data: data.filter(d => d.totalLeads > 0) })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}
