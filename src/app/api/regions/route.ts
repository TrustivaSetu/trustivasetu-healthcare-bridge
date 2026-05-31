import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

export async function GET() {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const regions = await db.region.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
  return NextResponse.json({ data: regions })
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const schema = z.object({ name: z.string().min(2), code: z.string().min(2).max(10).toUpperCase() })
  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })

  const region = await db.region.create({ data: parsed.data })
  return NextResponse.json({ data: region }, { status: 201 })
}
