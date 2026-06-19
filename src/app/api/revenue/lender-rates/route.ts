import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

// GET /api/revenue/lender-rates — list agreed lender rates (optionally by lender)
export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'CLINIC_USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const lenderId = searchParams.get('lenderId')

  const rates = await db.lenderRate.findMany({
    where: lenderId ? { lenderId } : undefined,
    include: { lender: { select: { id: true, name: true, code: true, isActive: true } } },
    orderBy: [{ lender: { name: 'asc' } }, { effectiveFrom: 'desc' }],
  })
  return NextResponse.json({ data: rates })
}

const createSchema = z.object({
  lenderId: z.string().min(1),
  agreedRatePct: z.number().min(0).max(100),
  effectiveFrom: z.string().datetime().optional(),
  effectiveTo: z.string().datetime().nullable().optional(),
  notes: z.string().max(500).optional(),
})

// POST /api/revenue/lender-rates — create a rate record (ADMIN only)
export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = createSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }
  const d = parsed.data

  const lender = await db.lender.findUnique({ where: { id: d.lenderId } })
  if (!lender) return NextResponse.json({ error: 'Lender not found' }, { status: 404 })

  const rate = await db.lenderRate.create({
    data: {
      lenderId: d.lenderId,
      agreedRatePct: d.agreedRatePct,
      effectiveFrom: d.effectiveFrom ? new Date(d.effectiveFrom) : undefined,
      effectiveTo: d.effectiveTo ? new Date(d.effectiveTo) : null,
      notes: d.notes,
      createdById: session.user.id,
    },
    include: { lender: { select: { id: true, name: true, code: true, isActive: true } } },
  })

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'CREATE',
      entity: 'LenderRate',
      entityId: rate.id,
      details: JSON.stringify({ lender: lender.name, agreedRatePct: d.agreedRatePct }),
    },
  }).catch(() => {})

  return NextResponse.json({ data: rate }, { status: 201 })
}
