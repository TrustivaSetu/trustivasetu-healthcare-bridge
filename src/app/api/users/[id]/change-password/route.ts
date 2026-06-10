import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const schema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, 'USER_UPDATE'))
    return NextResponse.json({ error: 'You do not have permission to change passwords' }, { status: 403 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })

  const target = await db.user.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const hashed = await bcrypt.hash(parsed.data.newPassword, 12)
  await db.user.update({ where: { id: params.id }, data: { password: hashed } })

  await db.auditLog.create({
    data: { userId: session.user.id, action: 'UPDATE', entity: 'User', entityId: params.id },
  })

  return NextResponse.json({ success: true })
}
