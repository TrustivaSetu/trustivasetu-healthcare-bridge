import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { buildClinicFilter } from '@/lib/permissions'
import * as XLSX from 'xlsx'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? 'leads'
  const { role, regionIds, clinicIds } = session.user

  const clinicFilter = buildClinicFilter(role, regionIds, clinicIds)
  const clinics = await db.clinic.findMany({ where: { ...clinicFilter, isActive: true }, select: { id: true } })
  const clinicIdList = clinics.map(c => c.id)

  const wb = XLSX.utils.book_new()

  if (type === 'leads') {
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const status = searchParams.get('status')

    const where: Record<string, unknown> = { clinicId: { in: clinicIdList } }
    if (status) where.status = status
    if (dateFrom || dateTo) {
      where.applicationDate = {}
      if (dateFrom) (where.applicationDate as Record<string, unknown>).gte = new Date(dateFrom)
      if (dateTo) (where.applicationDate as Record<string, unknown>).lte = new Date(dateTo + 'T23:59:59')
    }

    const leads = await db.lead.findMany({
      where,
      include: {
        clinic: { select: { name: true, region: { select: { name: true } } } },
        lender: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { applicationDate: 'desc' },
    })

    const rows = leads.map(l => ({
      'External ID': l.externalId ?? '',
      'Applicant Name': l.applicantName,
      'Phone': l.phone ?? '',
      'Email': l.email ?? '',
      'Clinic': l.clinic.name,
      'Region': l.clinic.region.name,
      'Lender': l.lender?.name ?? '',
      'Applied Amount (₹L)': l.amount,
      'Status': l.status,
      'Approved Amount (₹L)': l.approvedAmount ?? '',
      'Disbursed Amount (₹L)': l.disbursedAmount ?? '',
      'Application Date': format(new Date(l.applicationDate), 'dd/MM/yyyy'),
      'Approval Date': l.approvalDate ? format(new Date(l.approvalDate), 'dd/MM/yyyy') : '',
      'Disbursal Date': l.disbursalDate ? format(new Date(l.disbursalDate), 'dd/MM/yyyy') : '',
      'Remarks': l.remarks ?? '',
      'Created By': l.createdBy?.name ?? '',
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Leads')
  }

  if (type === 'clinics') {
    const clinicsFull = await db.clinic.findMany({
      where: { ...clinicFilter, isActive: true },
      include: { region: true, assignedRM: { select: { name: true } } },
      orderBy: { name: 'asc' },
    })

    const now = new Date()
    const rows = await Promise.all(clinicsFull.map(async c => {
      const mtdStart = startOfMonth(now)
      const prevStart = startOfMonth(subMonths(now, 1))
      const prevEnd = endOfMonth(subMonths(now, 1))

      const [total, mtd, lmtd, mtdDisbAgg, lmtdDisbAgg] = await Promise.all([
        db.lead.count({ where: { clinicId: c.id } }),
        db.lead.count({ where: { clinicId: c.id, applicationDate: { gte: mtdStart } } }),
        db.lead.count({ where: { clinicId: c.id, applicationDate: { gte: prevStart, lte: prevEnd } } }),
        db.lead.aggregate({ _sum: { disbursedAmount: true }, where: { clinicId: c.id, status: 'DISBURSED', disbursalDate: { gte: mtdStart } } }),
        db.lead.aggregate({ _sum: { disbursedAmount: true }, where: { clinicId: c.id, status: 'DISBURSED', disbursalDate: { gte: prevStart, lte: prevEnd } } }),
      ])

      return {
        'Clinic Name': c.name,
        'Region': c.region.name,
        'Address': c.address,
        'Contact Person': c.contactPerson,
        'Contact Number': c.contactNumber,
        'Email': c.email ?? '',
        'Account Number': c.accountNumber ?? '',
        'Business Potential (₹L)': c.businessPotential ?? '',
        'Assigned RM': c.assignedRM?.name ?? '',
        'Onboarded Date': format(new Date(c.onboardedAt), 'dd/MM/yyyy'),
        'Total Leads': total,
        'MTD Leads': mtd,
        'LMTD Leads': lmtd,
        'Lead Growth %': lmtd > 0 ? (((mtd - lmtd) / lmtd) * 100).toFixed(1) : '',
        'MTD Disbursal (₹L)': mtdDisbAgg._sum.disbursedAmount ?? 0,
        'LMTD Disbursal (₹L)': lmtdDisbAgg._sum.disbursedAmount ?? 0,
      }
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Clinics')
  }

  if (type === 'lender') {
    const lenders = await db.lender.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
    const rows = await Promise.all(lenders.map(async lender => {
      const where = { clinicId: { in: clinicIdList }, lenderId: lender.id }
      const [tl, ap, di, av, dv] = await Promise.all([
        db.lead.count({ where }),
        db.lead.count({ where: { ...where, status: { in: ['APPROVED', 'DISBURSED'] } } }),
        db.lead.count({ where: { ...where, status: 'DISBURSED' } }),
        db.lead.aggregate({ _sum: { approvedAmount: true }, where: { ...where, status: { in: ['APPROVED', 'DISBURSED'] } } }),
        db.lead.aggregate({ _sum: { disbursedAmount: true }, where: { ...where, status: 'DISBURSED' } }),
      ])
      return {
        'Lender': lender.name,
        'Code': lender.code,
        'Total Leads': tl,
        'Approved': ap,
        'Disbursed': di,
        'Approved Value (₹L)': (av._sum.approvedAmount ?? 0).toFixed(2),
        'Disbursed Value (₹L)': (dv._sum.disbursedAmount ?? 0).toFixed(2),
        'Approval Rate %': tl > 0 ? ((ap / tl) * 100).toFixed(1) : '0',
        'Disbursal Rate %': tl > 0 ? ((di / tl) * 100).toFixed(1) : '0',
      }
    }))
    const ws = XLSX.utils.json_to_sheet(rows.filter(r => r['Total Leads'] > 0))
    XLSX.utils.book_append_sheet(wb, ws, 'Lender Approvals')
  }

  if (type === 'dashboard' || type === 'report') {
    const reportType = searchParams.get('reportType') ?? 'monthly'
    const months = 6
    const now = new Date()

    if (reportType === 'monthly') {
      const rows = []
      for (let i = months - 1; i >= 0; i--) {
        const mo = subMonths(now, i)
        const start = startOfMonth(mo), end = endOfMonth(mo)
        const where = { clinicId: { in: clinicIdList }, applicationDate: { gte: start, lte: end } }

        const [tl, ap, di, lv, av, dv] = await Promise.all([
          db.lead.count({ where }),
          db.lead.count({ where: { ...where, status: { in: ['APPROVED', 'DISBURSED'] } } }),
          db.lead.count({ where: { ...where, status: 'DISBURSED' } }),
          db.lead.aggregate({ _sum: { amount: true }, where }),
          db.lead.aggregate({ _sum: { approvedAmount: true }, where: { ...where, status: { in: ['APPROVED', 'DISBURSED'] } } }),
          db.lead.aggregate({ _sum: { disbursedAmount: true }, where: { ...where, status: 'DISBURSED' } }),
        ])

        rows.push({
          'Month': format(mo, 'MMMM yyyy'),
          'Total Leads': tl, 'Approved': ap, 'Disbursed': di,
          'Lead Value (₹L)': (lv._sum.amount ?? 0).toFixed(2),
          'Approved Value (₹L)': (av._sum.approvedAmount ?? 0).toFixed(2),
          'Disbursed Value (₹L)': (dv._sum.disbursedAmount ?? 0).toFixed(2),
          'Approval Rate %': tl > 0 ? ((ap / tl) * 100).toFixed(1) : '0',
        })
      }
      const ws = XLSX.utils.json_to_sheet(rows)
      XLSX.utils.book_append_sheet(wb, ws, 'Monthly Report')
    }
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const fileName = `trustiva-lms-${type}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
    },
  })
}
