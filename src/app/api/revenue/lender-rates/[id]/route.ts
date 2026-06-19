import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const updateSchema = z.object({
  agreedRatePct: z.number().min(0).max(100).optional(),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
})

// PATCH /api/revenue/lender-rates/[id] — update a rate (ADMIN only)
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = updateSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }
  const d = parsed.data

  const rate = await db.lenderRate.update({
    where: { id: params.id },
    data: {
      ...(d.agreedRatePct !== undefined && { agreedRatePct: d.agreedRatePct }),
      ...(d.effectiveFrom && { effectiveFrom: new Date(d.effectiveFrom) }),
      ...(d.effectiveTo !== undefined && { effectiveTo: d.effectiveTo ? new Date(d.effectiveTo) : null }),
      ...(d.notes !== undefined && { notes: d.notes }),
    },
    include: { lender: { select: { id: true, name: true, code: true, isActive: true } } },
  })

  await db.auditLog.create({
    data: { userId: session.user.id, action: 'UPDATE', entity: 'LenderRate', entityId: rate.id, details: JSON.stringify(d) },
  }).catch(() => {})

  return NextResponse.json({ data: rate })
}

// DELETE /api/revenue/lender-rates/[id] — remove a rate (ADMIN only)
export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await db.lenderRate.delete({ where: { id: params.id } })

  await db.auditLog.create({
    data: { userId: session.user.id, action: 'DELETE', entity: 'LenderRate', entityId: params.id },
  }).catch(() => {})

  return NextResponse.json({ success: true })
}
