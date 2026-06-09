import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { generateClinicReportPdf } from '@/lib/pdf-report'

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'CLINIC_USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const clinicId = session.user.clinicIds[0]
  if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1))
  const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()))
  const fmt = searchParams.get('format') ?? 'xlsx'

  if (month < 1 || month > 12 || year < 2020 || year > 2100) {
    return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 })
  }

  const periodStart = startOfMonth(new Date(year, month - 1, 1))
  const periodEnd = endOfMonth(new Date(year, month - 1, 1))
  const periodLabel = format(periodStart, 'MMMM yyyy')

  const clinic = await db.clinic.findUnique({
    where: { id: clinicId },
    select: { name: true, contactPerson: true, contactNumber: true, email: true },
  })
  if (!clinic) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })

  const leadsWhere = {
    clinicId,
    applicationDate: { gte: periodStart, lte: periodEnd },
  }

  const [leads, disbursals, aggregate, disbursalAggregate] = await Promise.all([
    db.lead.findMany({
      where: leadsWhere,
      include: { lender: { select: { name: true } } },
      orderBy: { applicationDate: 'desc' },
    }),
    db.lead.findMany({
      where: { clinicId, status: 'DISBURSED', disbursalDate: { gte: periodStart, lte: periodEnd } },
      include: { lender: { select: { name: true } } },
      orderBy: { disbursalDate: 'desc' },
    }),
    db.lead.groupBy({
      by: ['status'],
      where: leadsWhere,
      _count: { id: true },
      _sum: { amount: true },
    }),
    db.lead.aggregate({
      where: { clinicId, status: 'DISBURSED', disbursalDate: { gte: periodStart, lte: periodEnd } },
      _sum: { disbursedAmount: true },
      _count: { id: true },
    }),
  ])

  const statusMap: Record<string, { count: number; sum: number }> = {}
  for (const g of aggregate) {
    statusMap[g.status] = { count: g._count.id, sum: g._sum.amount ?? 0 }
  }

  const totalLeads = leads.length
  const approved = (statusMap['APPROVED']?.count ?? 0) + (statusMap['DISBURSED']?.count ?? 0)
  const disbursed = statusMap['DISBURSED']?.count ?? 0
  const rejected = statusMap['REJECTED']?.count ?? 0
  const pending = statusMap['PENDING']?.count ?? 0
  const totalAppliedValue = Object.values(statusMap).reduce((a, b) => a + b.sum, 0)
  const totalDisbursedValue = disbursalAggregate._sum.disbursedAmount ?? 0
  const approvalRate = totalLeads > 0 ? ((approved / totalLeads) * 100).toFixed(1) : '0.0'
  const disbursalRate = totalLeads > 0 ? ((disbursed / totalLeads) * 100).toFixed(1) : '0.0'

  // ── PDF branch ────────────────────────────────────────────────────────────
  if (fmt === 'pdf') {
    const safeName = clinic.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    const filename = `report-${safeName}-${year}-${String(month).padStart(2, '0')}.pdf`
    const pdfBuffer = await generateClinicReportPdf({
      clinic,
      leads: leads as Parameters<typeof generateClinicReportPdf>[0]['leads'],
      disbursals: disbursals as Parameters<typeof generateClinicReportPdf>[0]['disbursals'],
      periodLabel,
      totalLeads,
      approved,
      disbursed,
      pending,
      rejected,
      totalAppliedValue,
      totalDisbursedValue,
      approvalRate,
      disbursalRate,
    })
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  }

  const wb = XLSX.utils.book_new()

  // ── Sheet 1: Summary ──────────────────────────────────────────────────────
  const summaryRows = [
    ['Clinic Report', periodLabel],
    ['Clinic Name', clinic.name],
    ['Contact Person', clinic.contactPerson],
    ['Contact Number', clinic.contactNumber],
    ['Email', clinic.email ?? ''],
    ['Generated On', format(new Date(), 'dd/MM/yyyy HH:mm')],
    [],
    ['METRIC', 'VALUE'],
    ['Total Leads Submitted', totalLeads],
    ['Approved / Disbursed Leads', approved],
    ['Disbursed Leads', disbursed],
    ['Pending Leads', pending],
    ['Rejected Leads', rejected],
    ['Total Applied Value (₹L)', totalAppliedValue.toFixed(2)],
    ['Total Disbursed Value (₹L)', totalDisbursedValue.toFixed(2)],
    ['Approval Rate (%)', approvalRate],
    ['Disbursal Rate (%)', disbursalRate],
  ]
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows)
  wsSummary['!cols'] = [{ wch: 30 }, { wch: 25 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

  // ── Sheet 2: All Leads ────────────────────────────────────────────────────
  const leadRows = leads.map((l, i) => ({
    '#': i + 1,
    'Patient Name': l.applicantName,
    'Phone': l.phone ?? '',
    'Applied Amount (₹L)': l.amount,
    'Status': l.status,
    'Approved Amount (₹L)': l.approvedAmount ?? '',
    'Disbursed Amount (₹L)': l.disbursedAmount ?? '',
    'Lender': l.lender?.name ?? '',
    'UTR Number': l.utrNumber ?? '',
    'Application Date': format(new Date(l.applicationDate), 'dd/MM/yyyy'),
    'Approval Date': l.approvalDate ? format(new Date(l.approvalDate), 'dd/MM/yyyy') : '',
    'Disbursal Date': l.disbursalDate ? format(new Date(l.disbursalDate), 'dd/MM/yyyy') : '',
    'Remarks': l.remarks ?? '',
  }))

  const wsLeads = XLSX.utils.json_to_sheet(leadRows.length > 0 ? leadRows : [{ '#': '', 'Patient Name': 'No leads in this period' }])
  wsLeads['!cols'] = [
    { wch: 4 }, { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 12 },
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 20 },
  ]
  XLSX.utils.book_append_sheet(wb, wsLeads, 'All Leads')

  // ── Sheet 3: Disbursals ────────────────────────────────────────────────────
  const disbursalRows = disbursals.map((d, i) => ({
    '#': i + 1,
    'Patient Name': d.applicantName,
    'Phone': d.phone ?? '',
    'Applied Amount (₹L)': d.amount,
    'Approved Amount (₹L)': d.approvedAmount ?? '',
    'Disbursed Amount (₹L)': d.disbursedAmount ?? '',
    'UTR Number': d.utrNumber ?? '',
    'Lender': d.lender?.name ?? '',
    'Application Date': format(new Date(d.applicationDate), 'dd/MM/yyyy'),
    'Disbursal Date': d.disbursalDate ? format(new Date(d.disbursalDate), 'dd/MM/yyyy') : '',
  }))

  const wsDisbursals = XLSX.utils.json_to_sheet(disbursalRows.length > 0 ? disbursalRows : [{ '#': '', 'Patient Name': 'No disbursals in this period' }])
  wsDisbursals['!cols'] = [
    { wch: 4 }, { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 18 },
    { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 14 },
  ]
  XLSX.utils.book_append_sheet(wb, wsDisbursals, 'Disbursals')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const filename = `report-${clinic.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${year}-${String(month).padStart(2, '0')}.xlsx`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
