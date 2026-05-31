import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  leadsTarget: z.number().int().min(0),
  disbursalTarget: z.number().min(0),
  userId: z.string().optional(),
  regionId: z.string().optional(),
  clinicId: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear()
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : new Date().getMonth() + 1

  const targets = await db.target.findMany({
    where: { year, month },
    include: {
      user: { select: { id: true, name: true } },
      region: { select: { id: true, name: true } },
      clinic: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ data: targets })
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })

  const { year, month, userId, regionId, clinicId, leadsTarget, disbursalTarget } = parsed.data

  const existing = await db.target.findFirst({
    where: {
      year,
      month,
      userId: userId ?? null,
      regionId: regionId ?? null,
      clinicId: clinicId ?? null,
    },
  })

  if (existing) {
    const target = await db.target.update({
      where: { id: existing.id },
      data: { leadsTarget, disbursalTarget },
    })
    return NextResponse.json({ data: target })
  }

  const target = await db.target.create({ data: parsed.data })
  await db.auditLog.create({
    data: { userId: session.user.id, action: 'CREATE', entity: 'Target', entityId: target.id },
  })
  return NextResponse.json({ data: target }, { status: 201 })
}
