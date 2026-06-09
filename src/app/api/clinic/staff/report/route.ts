import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { generateStaffReportPdf } from '@/lib/pdf-staff-report'

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  REGIONAL_MANAGER: 'Regional Manager',
  TEAM_MEMBER: 'Team Member',
}

const TYPE_LABEL: Record<string, string> = {
  PRESENT: 'Present', LEAVE: 'Leave', OUTSTATION: 'Outstation',
}

const LEAVE_LABEL: Record<string, string> = {
  PL: 'Paid Leave', CL: 'Casual Leave', MEDICAL: 'Medical Leave', UNPLANNED: 'Unplanned Leave',
}

const WORKING_LABEL: Record<string, string> = { FULL_DAY: 'Full Day', HALF_DAY: 'Half Day' }

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

  if (month < 1 || month > 12 || year < 2020 || year > 2100) {
    return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 })
  }
  const fmt = searchParams.get('format') ?? 'xlsx'

  const periodStart = startOfMonth(new Date(year, month - 1, 1))
  const periodEnd = endOfMonth(new Date(year, month - 1, 1))
  const periodLabel = format(periodStart, 'MMMM yyyy')

  const clinic = await db.clinic.findUnique({
    where: { id: clinicId },
    select: { name: true },
  })
  if (!clinic) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })

  const assignments = await db.userClinic.findMany({
    where: { clinicId },
    include: {
      user: {
        select: {
          id: true, name: true, email: true, phone: true, role: true, isActive: true,
          employeeProfile: {
            select: { designation: true, department: true, dateOfJoining: true },
          },
        },
      },
    },
  })

  const staffUsers = assignments
    .map(a => a.user)
    .filter(u => u.role !== 'CLINIC_USER' && u.isActive)

  const staffIds = staffUsers.map(u => u.id)

  const [leadGroups, attendanceRecords, halfDayGroups] = staffIds.length > 0
    ? await Promise.all([
        db.lead.groupBy({
          by: ['createdById', 'status'],
          where: { clinicId, createdById: { in: staffIds }, applicationDate: { gte: periodStart, lte: periodEnd } },
          _count: { id: true },
          _sum: { disbursedAmount: true },
        }),
        db.attendance.findMany({
          where: { userId: { in: staffIds }, date: { gte: periodStart, lte: periodEnd } },
          orderBy: [{ userId: 'asc' }, { date: 'asc' }],
          include: { user: { select: { name: true } } },
        }),
        db.attendance.groupBy({
          by: ['userId'],
          where: {
            userId: { in: staffIds },
            date: { gte: periodStart, lte: periodEnd },
            attendanceType: 'PRESENT',
            workingType: 'HALF_DAY',
          },
          _count: { id: true },
        }),
      ])
    : [[], [], []]

  // ── PDF branch ────────────────────────────────────────────────────────────
  if (fmt === 'pdf') {
    const staffForPdf = staffUsers.map(u => {
      const userLeads = leadGroups.filter(g => g.createdById === u.id)
      const totalL = userLeads.reduce((s, g) => s + g._count.id, 0)
      const disbC = userLeads.find(g => g.status === 'DISBURSED')?._count.id ?? 0
      const disbV = userLeads.find(g => g.status === 'DISBURSED')?._sum.disbursedAmount ?? 0
      const attGroups2 = attendanceRecords.filter(a => a.userId === u.id)
      const present = attGroups2.filter(a => a.attendanceType === 'PRESENT').length
      const leave = attGroups2.filter(a => a.attendanceType === 'LEAVE').length
      const outstation = attGroups2.filter(a => a.attendanceType === 'OUTSTATION').length
      const halfDay = halfDayGroups.find(g => g.userId === u.id)?._count.id ?? 0
      return {
        id: u.id, name: u.name, email: u.email, phone: u.phone ?? null,
        role: u.role,
        designation: u.employeeProfile?.designation ?? null,
        department: u.employeeProfile?.department ?? null,
        dateOfJoining: u.employeeProfile?.dateOfJoining ?? null,
        leads: { total: totalL, disbursed: disbC, disbursedValue: disbV },
        attendance: { present, leave, outstation, halfDay },
      }
    })

    const totalLeadsAll = staffForPdf.reduce((s, m) => s + m.leads.total, 0)
    const totalDisbAll = staffForPdf.reduce((s, m) => s + m.leads.disbursed, 0)
    const totalDisbValueAll = staffForPdf.reduce((s, m) => s + m.leads.disbursedValue, 0)

    const safeName = clinic.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()
    const filename = `staff-report-${safeName}-${year}-${String(month).padStart(2, '0')}.pdf`
    const pdfBuffer = await generateStaffReportPdf({
      clinicName: clinic.name,
      periodLabel,
      staff: staffForPdf,
      totalLeads: totalLeadsAll,
      totalDisbursed: totalDisbAll,
      totalDisbursedValue: totalDisbValueAll,
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

  // ── Sheet 1: Staff Directory ───────────────────────────────────────────────
  const staffRows = staffUsers.map((u, i) => ({
    '#': i + 1,
    'Name': u.name,
    'Role': ROLE_LABEL[u.role] ?? u.role,
    'Designation': u.employeeProfile?.designation ?? '',
    'Department': u.employeeProfile?.department ?? '',
    'Email': u.email,
    'Phone': u.phone ?? '',
    'Date of Joining': u.employeeProfile?.dateOfJoining
      ? format(new Date(u.employeeProfile.dateOfJoining), 'dd/MM/yyyy')
      : '',
  }))

  const wsDirectory = XLSX.utils.json_to_sheet(
    staffRows.length > 0 ? staffRows : [{ '#': '', Name: 'No staff assigned to this clinic' }]
  )
  wsDirectory['!cols'] = [{ wch: 4 }, { wch: 22 }, { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 28 }, { wch: 14 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, wsDirectory, 'Staff Directory')

  // ── Sheet 2: Lead Performance ─────────────────────────────────────────────
  const perfRows = staffUsers.map((u, i) => {
    const userLeads = leadGroups.filter(g => g.createdById === u.id)
    const totalLeads = userLeads.reduce((s, g) => s + g._count.id, 0)
    const approved = userLeads.filter(g => ['APPROVED', 'DISBURSED'].includes(g.status ?? '')).reduce((s, g) => s + g._count.id, 0)
    const disbursed = userLeads.find(g => g.status === 'DISBURSED')?._count.id ?? 0
    const disbursedValue = userLeads.find(g => g.status === 'DISBURSED')?._sum.disbursedAmount ?? 0
    const approvalRate = totalLeads > 0 ? ((approved / totalLeads) * 100).toFixed(1) + '%' : '0.0%'

    return {
      '#': i + 1,
      'Staff Name': u.name,
      'Role': ROLE_LABEL[u.role] ?? u.role,
      'Designation': u.employeeProfile?.designation ?? '',
      [`Total Leads (${periodLabel})`]: totalLeads,
      'Approved / Disbursed': approved,
      'Disbursed Count': disbursed,
      'Disbursed Value (₹L)': disbursedValue > 0 ? disbursedValue.toFixed(2) : '',
      'Approval Rate': approvalRate,
    }
  })

  const wsPerf = XLSX.utils.json_to_sheet(
    perfRows.length > 0 ? perfRows : [{ '#': '', 'Staff Name': 'No staff data' }]
  )
  wsPerf['!cols'] = [
    { wch: 4 }, { wch: 22 }, { wch: 18 }, { wch: 20 },
    { wch: 20 }, { wch: 20 }, { wch: 16 }, { wch: 20 }, { wch: 14 },
  ]
  XLSX.utils.book_append_sheet(wb, wsPerf, 'Lead Performance')

  // ── Sheet 3: Attendance Summary ───────────────────────────────────────────
  const summaryRows = staffUsers.map((u, i) => {
    const userAtt = attendanceRecords.filter(a => a.userId === u.id)
    const present = userAtt.filter(a => a.attendanceType === 'PRESENT').length
    const leave = userAtt.filter(a => a.attendanceType === 'LEAVE').length
    const outstation = userAtt.filter(a => a.attendanceType === 'OUTSTATION').length
    const halfDay = halfDayGroups.find(g => g.userId === u.id)?._count.id ?? 0
    const totalRecorded = userAtt.length

    return {
      '#': i + 1,
      'Staff Name': u.name,
      'Present Days': present,
      'Half Days': halfDay,
      'Leave Days': leave,
      'Outstation Days': outstation,
      'Total Recorded': totalRecorded,
    }
  })

  const wsSummary = XLSX.utils.json_to_sheet(
    summaryRows.length > 0 ? summaryRows : [{ '#': '', 'Staff Name': 'No attendance data' }]
  )
  wsSummary['!cols'] = [
    { wch: 4 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 14 },
  ]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Attendance Summary')

  // ── Sheet 4: Attendance Detail ─────────────────────────────────────────────
  const detailRows = attendanceRecords.map(r => ({
    'Staff Name': r.user.name,
    'Date': format(new Date(r.date), 'dd/MM/yyyy'),
    'Day': format(new Date(r.date), 'EEEE'),
    'Status': TYPE_LABEL[r.attendanceType] ?? r.attendanceType,
    'Working': WORKING_LABEL[r.workingType] ?? r.workingType,
    'Leave Type': r.leaveType ? (LEAVE_LABEL[r.leaveType] ?? r.leaveType) : '',
    'Outstation City': r.outstationCity ?? '',
    'Check-in Time': r.timeIn ?? '',
    'Location': r.locationName ?? '',
    'Notes': r.notes ?? '',
    'Approval': r.approvalStatus,
  }))

  const wsDetail = XLSX.utils.json_to_sheet(
    detailRows.length > 0 ? detailRows : [{ 'Staff Name': 'No attendance records', Date: '', Day: '', Status: '', Working: '', 'Leave Type': '', 'Outstation City': '', 'Check-in Time': '', Location: '', Notes: '', Approval: '' }]
  )
  wsDetail['!cols'] = [
    { wch: 22 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 24 }, { wch: 12 },
  ]
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Attendance Detail')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const safeName = clinic.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()
  const filename = `staff-report-${safeName}-${year}-${String(month).padStart(2, '0')}.xlsx`

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
