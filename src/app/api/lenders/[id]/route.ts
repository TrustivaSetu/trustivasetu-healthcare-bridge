import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  code: z.string().min(2).max(10).optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role as string)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const parsed = updateSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })

  const data = parsed.data
  const lender = await db.lender.update({
    where: { id: params.id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.code && { code: data.code.toUpperCase() }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.metadata && { metadata: data.metadata as object }),
    },
  })
  return NextResponse.json({ data: lender })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Only Super Admin can delete lenders' }, { status: 403 })
  }

  await db.lender.update({ where: { id: params.id }, data: { isActive: false } })
  return NextResponse.json({ success: true })
}