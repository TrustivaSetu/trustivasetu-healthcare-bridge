import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'

function isAdmin(role: string) { return role === 'SUPER_ADMIN' || role === 'ADMIN' }

const TYPE_LABEL: Record<string, string> = {
  PRESENT: 'Present', LEAVE: 'Leave', OUTSTATION: 'Outstation',
}
const LEAVE_LABEL: Record<string, string> = {
  PL: 'Paid Leave', CL: 'Casual Leave', MEDICAL: 'Medical Leave', UNPLANNED: 'Unplanned Leave',
}
const WORKING_LABEL: Record<string, string> = { FULL_DAY: 'Full Day', HALF_DAY: 'Half Day' }
const APPROVAL_LABEL: Record<string, string> = { PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected' }

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')   // single user or omit for all
  const month = searchParams.get('month')     // YYYY-MM required

  if (!month) return NextResponse.json({ error: 'month param required (YYYY-MM)' }, { status: 400 })
  const [y, m] = month.split('-').map(Number)

  const dateFilter = {
    gte: new Date(Date.UTC(y, m - 1, 1)),
    lt: new Date(Date.UTC(y, m, 1)),
  }

  const where: Record<string, unknown> = { date: dateFilter }
  if (userId) where.userId = userId

  const records = await db.attendance.findMany({
    where,
    orderBy: [{ userId: 'asc' }, { date: 'asc' }],
    include: {
      user: { select: { name: true, email: true, employeeProfile: { select: { department: true, designation: true } } } },
      approvedBy: { select: { name: true } },
    },
  })

  const rows = records.map(r => {
    const d = new Date(r.date)
    const status = r.attendanceType === 'PRESENT'
      ? `${WORKING_LABEL[r.workingType] ?? r.workingType}`
      : r.attendanceType === 'LEAVE'
        ? `Leave - ${LEAVE_LABEL[r.leaveType ?? ''] ?? r.leaveType ?? ''}`
        : 'Outstation'

    return {
      'Employee Name': r.user.name,
      'Email': r.user.email,
      'Department': r.user.employeeProfile?.department ?? '',
      'Designation': r.user.employeeProfile?.designation ?? '',
      'Date': format(d, 'dd-MMM-yyyy'),
      'Day': format(d, 'EEEE'),
      'Check-in Time': r.timeIn ?? '',
      'Status': TYPE_LABEL[r.attendanceType],
      'Working': WORKING_LABEL[r.workingType],
      'Leave Type': r.leaveType ? LEAVE_LABEL[r.leaveType] ?? r.leaveType : '',
      'Outstation City': r.outstationCity ?? '',
      'Location': r.locationName ?? (r.latitude ? `${r.latitude.toFixed(4)},${r.longitude?.toFixed(4)}` : ''),
      'Approval Status': APPROVAL_LABEL[r.approvalStatus],
      'Approved By': r.approvedBy?.name ?? '',
      'Rejection Reason': r.rejectionReason ?? '',
      'Notes': r.notes ?? '',
    }
  })

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)

  // Column widths
  ws['!cols'] = [20, 28, 15, 20, 14, 12, 14, 12, 12, 18, 16, 22, 14, 16, 20, 22].map(w => ({ wch: w }))

  const sheetName = userId
    ? `Attendance_${format(new Date(y, m - 1), 'MMM_yyyy')}`
    : `All_Attendance_${format(new Date(y, m - 1), 'MMM_yyyy')}`

  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31))

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const filename = `${sheetName}.xlsx`

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
