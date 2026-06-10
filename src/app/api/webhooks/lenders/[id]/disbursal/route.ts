import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Called by lenders to confirm disbursals
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  try {
    const lender = await db.lender.findUnique({ where: { id: params.id } })
    if (!lender) return NextResponse.json({ error: 'Unknown lender' }, { status: 404 })

    const meta = (lender.metadata ?? {}) as Record<string, unknown>
    const secret = meta.webhookSecret as string | undefined
    if (secret) {
      const provided = req.headers.get('x-webhook-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
      if (provided !== secret) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { leadId, disbursedAmount, disbursalDate, utrNumber } = body

    if (!leadId || !disbursedAmount) {
      return NextResponse.json({ error: 'leadId and disbursedAmount are required' }, { status: 400 })
    }

    const lead = await db.lead.findFirst({ where: { id: leadId, lenderId: params.id } })
    if (!lead) return NextResponse.json({ error: 'Lead not found for this lender' }, { status: 404 })

    const disbursalUpdateData = {
      status: 'DISBURSED' as const,
      disbursedAmount: parseFloat(String(disbursedAmount)),
      disbursalDate: disbursalDate ? new Date(disbursalDate) : new Date(),
      utrNumber: utrNumber ?? undefined,
      nachStatus: 'DONE',
    }
    await db.lead.update({ where: { id: leadId }, data: disbursalUpdateData as any })

    await db.webhookEvent.create({
      data: {
        source: `lender:${lender.code}`,
        event: 'lender.disbursal',
        entity: 'LEAD',
        status: 'PROCESSED',
        payload: body,
      },
    })

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('[POST /api/webhooks/lenders/:id/disbursal]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
