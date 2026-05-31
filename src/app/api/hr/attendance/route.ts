import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { sendEmail, attendanceConfirmHtml, attendanceApprovalRequestHtml } from '@/lib/email'
import { format } from 'date-fns'
import { z } from 'zod'

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attendanceType: z.enum(['PRESENT', 'LEAVE', 'OUTSTATION']),
  leaveType: z.enum(['PL', 'CL', 'MEDICAL', 'UNPLANNED']).optional().nullable(),
  workingType: z.enum(['FULL_DAY', 'HALF_DAY']).default('FULL_DAY'),
  outstationCity: z.string().optional().nullable(),
  timeIn: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  locationName: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  userId: z.string().optional(),
})

const TYPE_LABEL: Record<string, string> = { PRESENT: 'Present', LEAVE: 'Leave', OUTSTATION: 'Outstation' }
const LEAVE_LABEL: Record<string, string> = { PL: 'Paid Leave', CL: 'Casual Leave', MEDICAL: 'Medical Leave', UNPLANNED: 'Unplanned Leave' }

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })

  const isAdmin = session.user.role === 'SUPER_ADMIN' || session.user.role === 'ADMIN'
  const targetUserId = parsed.data.userId && isAdmin ? parsed.data.userId : session.user.id

  const { userId: _uid, date, ...rest } = parsed.data
  const dateObj = new Date(date + 'T00:00:00.000Z')

  // Check if record is locked (approved) and user is not admin
  if (!isAdmin) {
    const existing = await db.attendance.findUnique({ where: { userId_date: { userId: targetUserId, date: dateObj } } })
    if (existing?.approvalStatus === 'APPROVED')
      return NextResponse.json({ error: 'This attendance record is locked after approval and cannot be edited.' }, { status: 403 })
  }

  // Generate approval token for new records
  const approvalToken = crypto.randomUUID()

  const record = await db.attendance.upsert({
    where: { userId_date: { userId: targetUserId, date: dateObj } },
    create: { userId: targetUserId, date: dateObj, ...rest, approvalStatus: 'PENDING', approvalToken },
    update: { ...rest, approvalStatus: 'PENDING', approvalToken },
    include: { user: { select: { name: true, email: true, reportingManager: { select: { id: true, name: true, email: true } }, reportingManagerId: true } } },
  })

  // Fire-and-forget email notifications
  void (async () => {
    try {
      const emp = record.user
      const dateStr = format(dateObj, 'dd MMM yyyy')
      const typeLabel = rest.attendanceType === 'LEAVE'
        ? `Leave — ${LEAVE_LABEL[rest.leaveType ?? ''] ?? rest.leaveType}`
        : `${TYPE_LABEL[rest.attendanceType]} ${rest.attendanceType !== 'OUTSTATION' ? `(${rest.workingType === 'HALF_DAY' ? 'Half Day' : 'Full Day'})` : `— ${rest.outstationCity ?? ''}`}`

      const baseUrl = process.env.NEXTAUTH_URL ?? 'https://lms.trustivasetu.com'

      // Email to employee
      await sendEmail({
        to: emp.email,
        subject: `Attendance Recorded — ${dateStr}`,
        html: attendanceConfirmHtml(emp.name, dateStr, typeLabel, rest.timeIn ?? ''),
      })

      // Find manager: reporting manager or fall back to admins
      const manager = emp.reportingManager
      if (manager) {
        const approveUrl = `${baseUrl}/api/hr/attendance/approve?token=${approvalToken}&action=approve`
        const rejectUrl = `${baseUrl}/api/hr/attendance/approve?token=${approvalToken}&action=reject`
        await sendEmail({
          to: manager.email,
          subject: `Attendance Approval Required — ${emp.name} — ${dateStr}`,
          html: attendanceApprovalRequestHtml({
            empName: emp.name,
            empEmail: emp.email,
            date: dateStr,
            type: typeLabel,
            timeIn: rest.timeIn ?? '',
            location: rest.locationName ?? '',
            notes: rest.notes ?? '',
            approveUrl,
            rejectUrl,
          }),
        })
      } else {
        // No manager — send to all admins
        const admins = await db.user.findMany({
          where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] }, isActive: true },
          select: { email: true },
        })
        const approveUrl = `${baseUrl}/api/hr/attendance/approve?token=${approvalToken}&action=approve`
        const rejectUrl = `${baseUrl}/api/hr/attendance/approve?token=${approvalToken}&action=reject`
        for (const admin of admins) {
          await sendEmail({
            to: admin.email,
            subject: `Attendance Approval Required — ${emp.name} — ${dateStr}`,
            html: attendanceApprovalRequestHtml({
              empName: emp.name, empEmail: emp.email, date: dateStr, type: typeLabel,
              timeIn: rest.timeIn ?? '', location: rest.locationName ?? '', notes: rest.notes ?? '',
              approveUrl, rejectUrl,
            }),
          })
        }
      }
    } catch (e) {
      console.error('[Attendance Email Error]', e)
    }
  })()

  return NextResponse.json({ data: record })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month')
  const userId = searchParams.get('userId')

  const isAdmin = session.user.role === 'SUPER_ADMIN' || session.user.role === 'ADMIN'
  const isManager = session.user.role === 'REGIONAL_MANAGER'

  let targetUserId = session.user.id
  if (userId) {
    if (!isAdmin && !isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    targetUserId = userId
  }

  const where: Record<string, unknown> = { userId: targetUserId }
  if (month) {
    const [y, m] = month.split('-').map(Number)
    where.date = {
      gte: new Date(Date.UTC(y, m - 1, 1)),
      lt: new Date(Date.UTC(y, m, 1)),
    }
  }

  const records = await db.attendance.findMany({
    where,
    orderBy: { date: 'asc' },
    include: { approvedBy: { select: { name: true } } },
  })

  // Escalation check: flag PENDING records > 24h for admins
  let pendingEscalations = 0
  if (isAdmin && !userId) {
    pendingEscalations = await db.attendance.count({
      where: {
        approvalStatus: 'PENDING',
        createdAt: { lt: new Date(Date.now() - 24 * 3600 * 1000) },
      },
    })
  }

  return NextResponse.json({ data: records, pendingEscalations })
}
