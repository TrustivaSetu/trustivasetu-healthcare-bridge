import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const updateSchema = z.object({
  name: z.string().min(2).optional(),
  code: z.string().min(2).max(10).optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getRequestSession()
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
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Only Super Admin can delete lenders' }, { status: 403 })
  }

  const lender = await db.lender.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, code: true, isActive: true, metadata: true },
  })
  if (!lender) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Save snapshot to RecycleBin before deleting
  await db.recycleBin.create({
    data: {
      entityType: 'Lender',
      entityId: lender.id,
      entityName: lender.name,
      deletedBy: session.user.id,
      snapshot: lender as object,
    },
  })

  // Hard delete: null out optional lenderId on leads first, then delete
  await db.lead.updateMany({ where: { lenderId: params.id }, data: { lenderId: null } })
  await db.lender.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}