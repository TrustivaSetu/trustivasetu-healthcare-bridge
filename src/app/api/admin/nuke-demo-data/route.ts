import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'

// POST /api/admin/nuke-demo-data — SUPER_ADMIN only
// Hard-deletes all demo/seed data. Keeps users, regions, role permissions, scheme templates.
export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Super Admin only' }, { status: 403 })
  }

  try {
    const counts = await Promise.all([
      db.lead.count(), db.clinic.count(), db.lender.count(),
      db.leaveRequest.count(), db.attendance.count(), db.expense.count(), db.clinicScheme.count(),
    ])
    const [leads, clinics, lenders, leaveRequests, attendances, expenses, clinicSchemes] = counts

    // Delete in FK-safe order
    await db.clinicScheme.deleteMany()
    await db.attendance.deleteMany()
    await db.leaveRequest.deleteMany()
    await db.expense.deleteMany()
    await db.lead.deleteMany()
    await db.target.deleteMany()
    await db.userClinic.deleteMany()
    await db.clinic.updateMany({ data: { assignedRMId: null } })
    await db.clinic.deleteMany()
    await db.lender.deleteMany()

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'NUKE_DEMO_DATA',
        entity: 'System',
        entityId: 'all',
        details: JSON.stringify({ leads, clinics, lenders, leaveRequests, attendances, expenses, clinicSchemes }),
      },
    })

    return NextResponse.json({
      success: true,
      deleted: { leads, clinics, lenders, leaveRequests, attendances, expenses, clinicSchemes },
    })
  } catch (e) {
    console.error('[POST /api/admin/nuke-demo-data]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
