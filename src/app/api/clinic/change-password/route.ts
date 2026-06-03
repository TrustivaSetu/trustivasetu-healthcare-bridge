import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { signTabToken, createTabSessionRecord, deleteTabSessionRecord } from '@/lib/tab-session'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'CLINIC_USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, password: true, email: true, name: true, role: true, clinicAssignments: { select: { clinicId: true } } },
  })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.password)
  if (!valid) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 })

  const hashed = await bcrypt.hash(parsed.data.newPassword, 12)
  await db.user.update({
    where: { id: user.id },
    data: { password: hashed, mustChangePassword: false },
  })

  // Delete old tab session and create a new one with mustChangePassword=false
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const oldToken = authHeader.slice(7)
    await deleteTabSessionRecord(oldToken)
  }

  const clinicIds = user.clinicAssignments.map((c: { clinicId: string }) => c.clinicId)
  const newPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as string,
    regionIds: [],
    clinicIds,
    mustChangePassword: false,
  }
  const newToken = await signTabToken(newPayload)
  await createTabSessionRecord(user.id, newToken)

  await db.auditLog.create({
    data: { userId: user.id, action: 'UPDATE', entity: 'User', entityId: user.id, details: 'Password changed by clinic user' },
  })

  return NextResponse.json({ success: true, token: newToken, user: newPayload })
}
