import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { calculateSalary, calculateMonthlyPayable, getWorkingDaysInMonth } from '@/lib/hr/salary'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ userId: string; yearMonth: string }> }
) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isAdmin = session.user.role === 'SUPER_ADMIN' || session.user.role === 'ADMIN'
  const isSelf = session.user.id === params.userId
  if (!isAdmin && !isSelf) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Only admins can view other users' payslips
  if (!isAdmin && !isSelf) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [yearStr, monthStr] = params.yearMonth.split('-')
  const year = parseInt(yearStr)
  const month = parseInt(monthStr)

  if (!year || !month || month < 1 || month > 12)
    return NextResponse.json({ error: 'Invalid yearMonth, use YYYY-MM' }, { status: 400 })

  const [user, salary, attendances, holidays] = await Promise.all([
    db.user.findUnique({
      where: { id: params.userId },
      select: { id: true, name: true, email: true, role: true, employeeProfile: true },
    }),
    db.salaryStructure.findUnique({ where: { userId: params.userId } }),
    db.attendance.findMany({
      where: {
        userId: params.userId,
        date: {
          gte: new Date(Date.UTC(year, month - 1, 1)),
          lt: new Date(Date.UTC(year, month, 1)),
        },
      },
    }),
    db.holiday.findMany({
      where: {
        date: {
          gte: new Date(Date.UTC(year, month - 1, 1)),
          lt: new Date(Date.UTC(year, month, 1)),
        },
      },
    }),
  ])

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const salaryComponents = salary ? calculateSalary(salary.grossSalary, salary.tds) : null
  const workingDays = getWorkingDaysInMonth(year, month, holidays.map(h => new Date(h.date)))
  const payableDays = (() => {
    let d = 0
    for (const a of attendances) {
      const half = a.workingType === 'HALF_DAY' ? 0.5 : 1
      if (a.attendanceType === 'PRESENT' || a.attendanceType === 'OUTSTATION') d += half
      else if (a.attendanceType === 'LEAVE' && (a.leaveType === 'PL' || a.leaveType === 'CL' || a.leaveType === 'MEDICAL')) d += half
    }
    return d
  })()

  const actualPayable = salaryComponents
    ? calculateMonthlyPayable(salaryComponents.netSalary, workingDays, attendances.map(a => ({
        attendanceType: a.attendanceType,
        leaveType: a.leaveType,
        workingType: a.workingType,
      })))
    : null

  const leaveSummary = { pl: 0, cl: 0, medical: 0, unplanned: 0, outstation: 0, present: 0, halfDay: 0 }
  for (const a of attendances) {
    if (a.attendanceType === 'PRESENT') {
      if (a.workingType === 'HALF_DAY') leaveSummary.halfDay++
      else leaveSummary.present++
    } else if (a.attendanceType === 'OUTSTATION') leaveSummary.outstation++
    else if (a.attendanceType === 'LEAVE') {
      if (a.leaveType === 'PL') leaveSummary.pl++
      else if (a.leaveType === 'CL') leaveSummary.cl++
      else if (a.leaveType === 'MEDICAL') leaveSummary.medical++
      else if (a.leaveType === 'UNPLANNED') leaveSummary.unplanned++
    }
  }

  return NextResponse.json({
    data: {
      user,
      year,
      month,
      workingDays,
      payableDays,
      salary: salaryComponents,
      actualPayable,
      leaveSummary,
      attendances,
    },
  })
}
