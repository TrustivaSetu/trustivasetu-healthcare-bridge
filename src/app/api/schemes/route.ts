// src/app/api/schemes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

// GET — all scheme templates
export async function GET() {
  const schemes = await db.schemeTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ tenure: 'asc' }, { advanceEmi: 'asc' }],
  })
  return NextResponse.json({ data: schemes })
}

// POST — add new custom scheme (Super Admin / Admin only)
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role as string)) {
    return NextResponse.json({ error: 'Only Admin can add schemes' }, { status: 403 })
  }

  const body = await req.json()
  const schema = z.object({
    tenure: z.number().int().min(1).max(120),
    advanceEmi: z.number().int().min(0),
  })
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 })

  const { tenure, advanceEmi } = parsed.data
  if (advanceEmi >= tenure) {
    return NextResponse.json({ error: 'Advance EMI must be less than tenure' }, { status: 400 })
  }

  const name = `${tenure}/${advanceEmi}`
  const existing = await db.schemeTemplate.findUnique({ where: { name } })
  if (existing) {
    // Reactivate if inactive
    if (!existing.isActive) {
      await db.schemeTemplate.update({ where: { name }, data: { isActive: true } })
      return NextResponse.json({ data: existing, message: 'Scheme reactivated' })
    }
    return NextResponse.json({ error: `Scheme ${name} already exists` }, { status: 409 })
  }

  const scheme = await db.schemeTemplate.create({
    data: {
      name,
      tenure,
      advanceEmi,
      balanceEmi: tenure - advanceEmi,
      isCustom: true,
    },
  })
  return NextResponse.json({ data: scheme }, { status: 201 })
}