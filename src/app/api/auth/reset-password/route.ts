import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { getRequestMeta } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const { email, newPassword } = await req.json()
  if (!email || !newPassword) return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
  if (newPassword.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })

  const normalizedEmail = email.toLowerCase().trim()

  // Must have a verified token
  const token = await db.otpToken.findFirst({
    where: { email: normalizedEmail, purpose: 'PASSWORD_RESET', verified: true },
    orderBy: { createdAt: 'desc' },
  })

  if (!token) return NextResponse.json({ error: 'OTP not verified. Please complete verification first.' }, { status: 400 })
  if (token.expiresAt < new Date()) {
    await db.otpToken.delete({ where: { id: token.id } })
    return NextResponse.json({ error: 'Session expired. Please start over.' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { email: normalizedEmail } })
  if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 })

  const hashed = await bcrypt.hash(newPassword, 12)
  await db.user.update({ where: { id: user.id }, data: { password: hashed } })

  // Cleanup token
  await db.otpToken.deleteMany({ where: { email: normalizedEmail, purpose: 'PASSWORD_RESET' } })

  const { ipAddress, userAgent } = getRequestMeta(req)
  await db.auditLog.create({
    data: { userId: user.id, action: 'PASSWORD_RESET', entity: 'User', entityId: user.id, ipAddress, userAgent },
  })

  return NextResponse.json({ success: true, message: 'Password changed successfully.' })
}
