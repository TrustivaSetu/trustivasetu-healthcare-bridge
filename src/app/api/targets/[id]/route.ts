import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const updateSchema = z.object({
  leadsTarget: z.number().int().min(0).optional(),
  disbursalTarget: z.number().min(0).optional(),
})

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const auth = await requirePermission('TARGET_MANAGE')
  if (auth.error) return auth.error

  const parsed = updateSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })

  const target = await db.target.update({ where: { id: params.id }, data: parsed.data })
  await db.auditLog.create({
    data: { userId: auth.user!.id, action: 'UPDATE', entity: 'Target', entityId: target.id },
  })
  return NextResponse.json({ data: target })
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const auth = await requirePermission('TARGET_MANAGE')
  if (auth.error) return auth.error

  await db.target.delete({ where: { id: params.id } })
  await db.auditLog.create({
    data: { userId: auth.user!.id, action: 'DELETE', entity: 'Target', entityId: params.id },
  })
  return NextResponse.json({ success: true })
}
