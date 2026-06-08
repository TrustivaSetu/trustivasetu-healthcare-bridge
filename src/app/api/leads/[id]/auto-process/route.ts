import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'

const AUTO_STATUSES = ['APPROVED', 'REJECTED', 'DOCS_PENDING'] as const

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (process.env.TESTING_MODE !== 'true') {
    return NextResponse.json({ error: 'Testing mode is not enabled' }, { status: 403 })
  }

  try {
    const lead = await db.lead.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, applicantName: true, amount: true, clinicId: true },
    })
    if (!lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const randomStatus = AUTO_STATUSES[Math.floor(Math.random() * AUTO_STATUSES.length)]

    const updateData: Record<string, unknown> = { status: randomStatus }
    if (randomStatus === 'APPROVED') {
      updateData.approvedAmount = lead.amount
      updateData.approvalDate = new Date()
    } else if (randomStatus === 'REJECTED') {
      updateData.rejectionReason = 'Auto-rejected (testing mode simulation)'
    }

    const updated = await db.lead.update({
      where: { id: params.id },
      data: updateData,
    })

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'AUTO_PROCESS',
        entity: 'Lead',
        entityId: params.id,
        details: JSON.stringify({ testingMode: true, assignedStatus: randomStatus }),
      },
    })

    return NextResponse.json({ data: { status: updated.status, leadId: params.id } })
  } catch (e) {
    console.error('[POST /api/leads/:id/auto-process]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
