import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { checkRolePermission } from '@/lib/role-permissions'
import { z } from 'zod'

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await checkRolePermission(session.user.role as string, 'LENDERS', 'VIEW')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const all = searchParams.get('all') === '1'

  const lenders = await db.lender.findMany({
    where: all ? undefined : { isActive: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({ data: lenders })
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const schema = z.object({
    name: z.string().min(2),
    code: z.string().min(2).max(10),
    metadata: z.record(z.unknown()).optional(),
  })

  const parsed = schema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })

  const lender = await db.lender.create({
    data: {
      name: parsed.data.name,
      code: parsed.data.code.toUpperCase(),
      metadata: parsed.data.metadata ? (parsed.data.metadata as object) : undefined,
    },
  })
  return NextResponse.json({ data: lender }, { status: 201 })
}