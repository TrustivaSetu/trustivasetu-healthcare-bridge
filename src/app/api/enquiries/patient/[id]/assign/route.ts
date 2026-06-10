import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role } = session.user
  if (!['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'TEAM_MEMBER'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  try {
    const enquiry = await db.patientEnquiry.findUnique({ where: { id } })
    if (!enquiry) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = await req.json()
    const { rmId, managerId } = body as { rmId?: string; managerId?: string }

    const updateData: Record<string, unknown> = {
      assignedById: session.user.id,
      assignedAt: new Date(),
    }

    if (enquiry.status === 'NEW') {
      updateData.status = 'IN_PROGRESS'
    }

    if (rmId) {
      const rm = await db.user.findUnique({
        where: { id: rmId },
        include: {
          regionAssignments: { include: { region: true } },
          reportingManager: { select: { id: true, name: true } },
        },
      })
      if (!rm) return NextResponse.json({ error: 'RM not found' }, { status: 404 })

      updateData.assignedRmId = rmId
      updateData.assignedRegion = rm.regionAssignments[0]?.region?.name ?? null
      updateData.assignedManagerId = rm.reportingManagerId ?? null
    } else if (managerId) {
      const manager = await db.user.findUnique({
        where: { id: managerId },
        include: { regionAssignments: { include: { region: true } } },
      })
      if (!manager) return NextResponse.json({ error: 'Manager not found' }, { status: 404 })

      updateData.assignedManagerId = managerId
      updateData.assignedRegion = manager.regionAssignments[0]?.region?.name ?? null
    }

    const updated = await db.patientEnquiry.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json({ data: updated })
  } catch (e) {
    console.error('[PATCH /api/enquiries/patient/:id/assign]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
