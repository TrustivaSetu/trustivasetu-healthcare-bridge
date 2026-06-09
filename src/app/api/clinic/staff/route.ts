import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { startOfMonth, endOfMonth } from 'date-fns'

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

  const periodStart = startOfMonth(new Date(year, month - 1, 1))
  const periodEnd = endOfMonth(new Date(year, month - 1, 1))

  // All staff assigned to this clinic (excluding CLINIC_USER itself)
  const assignments = await db.userClinic.findMany({
    where: { clinicId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
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

  if (staffUsers.length === 0) {
    return NextResponse.json({ data: [] })
  }

  const staffIds = staffUsers.map(u => u.id)

  // Lead counts per staff for this clinic+month
  const leadGroups = await db.lead.groupBy({
    by: ['createdById', 'status'],
    where: {
      clinicId,
      createdById: { in: staffIds },
      applicationDate: { gte: periodStart, lte: periodEnd },
    },
    _count: { id: true },
    _sum: { disbursedAmount: true },
  })

  // Attendance summary per staff for this month
  const attendanceGroups = await db.attendance.groupBy({
    by: ['userId', 'attendanceType'],
    where: {
      userId: { in: staffIds },
      date: { gte: periodStart, lte: periodEnd },
    },
    _count: { id: true },
  })

  // Half-day count (PRESENT + HALF_DAY)
  const halfDayGroups = await db.attendance.groupBy({
    by: ['userId'],
    where: {
      userId: { in: staffIds },
      date: { gte: periodStart, lte: periodEnd },
      attendanceType: 'PRESENT',
      workingType: 'HALF_DAY',
    },
    _count: { id: true },
  })

  const data = staffUsers.map(user => {
    const userLeads = leadGroups.filter(g => g.createdById === user.id)
    const totalLeads = userLeads.reduce((s, g) => s + g._count.id, 0)
    const disbursedCount = userLeads.find(g => g.status === 'DISBURSED')?._count.id ?? 0
    const disbursedValue = userLeads.find(g => g.status === 'DISBURSED')?._sum.disbursedAmount ?? 0

    const userAttendance = attendanceGroups.filter(g => g.userId === user.id)
    const presentDays = userAttendance.find(g => g.attendanceType === 'PRESENT')?._count.id ?? 0
    const leaveDays = userAttendance.find(g => g.attendanceType === 'LEAVE')?._count.id ?? 0
    const outstationDays = userAttendance.find(g => g.attendanceType === 'OUTSTATION')?._count.id ?? 0
    const halfDays = halfDayGroups.find(g => g.userId === user.id)?._count.id ?? 0

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      role: user.role,
      designation: user.employeeProfile?.designation ?? null,
      department: user.employeeProfile?.department ?? null,
      dateOfJoining: user.employeeProfile?.dateOfJoining ?? null,
      leads: { total: totalLeads, disbursed: disbursedCount, disbursedValue },
      attendance: { present: presentDays, leave: leaveDays, outstation: outstationDays, halfDay: halfDays },
    }
  })

  return NextResponse.json({ data, month, year })
}
