import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Called by lenders to report approval/rejection decisions
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  try {
    const lender = await db.lender.findUnique({ where: { id: params.id } })
    if (!lender) return NextResponse.json({ error: 'Unknown lender' }, { status: 404 })

    // Verify webhook secret if configured
    const meta = (lender.metadata ?? {}) as Record<string, unknown>
    const secret = meta.webhookSecret as string | undefined
    if (secret) {
      const provided = req.headers.get('x-webhook-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
      if (provided !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { leadId, status, approvedAmount, remarks } = body

    if (!leadId || !status) {
      return NextResponse.json({ error: 'leadId and status are required' }, { status: 400 })
    }

    const VALID = ['APPROVED', 'REJECTED', 'CANCELLED']
    if (!VALID.includes(status)) {
      return NextResponse.json({ error: `status must be one of: ${VALID.join(', ')}` }, { status: 400 })
    }

    const lead = await db.lead.findFirst({ where: { id: leadId, lenderId: params.id } })
    if (!lead) return NextResponse.json({ error: 'Lead not found for this lender' }, { status: 404 })

    const updateData: Record<string, unknown> = {
      status,
      remarks: remarks ?? undefined,
    }
    if (status === 'APPROVED' && approvedAmount) {
      updateData.approvedAmount = parseFloat(String(approvedAmount))
      updateData.approvalDate = new Date()
    }
    if (status === 'REJECTED') {
      updateData.rejectionReason = remarks ?? undefined
    }

    await db.lead.update({ where: { id: leadId }, data: updateData as any })
    await db.webhookEvent.create({
      data: {
        source: `lender:${lender.code}`,
        event: 'lender.status',
        entity: 'LEAD',
        status: 'PROCESSED',
        payload: body,
      },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[POST /api/webhooks/lenders/:id/status]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
