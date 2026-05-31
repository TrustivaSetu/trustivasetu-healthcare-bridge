import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const MAX_ATTEMPTS = 5
const BLOCK_MINUTES = 15

export async function POST(req: NextRequest) {
  const { email, emailOtp } = await req.json()
  if (!email || !emailOtp) return NextResponse.json({ error: 'Email and OTP required' }, { status: 400 })

  const normalizedEmail = email.toLowerCase().trim()

  const token = await db.otpToken.findFirst({
    where: { email: normalizedEmail, purpose: 'PASSWORD_RESET', verified: false },
    orderBy: { createdAt: 'desc' },
  })

  if (!token) return NextResponse.json({ error: 'No OTP request found. Please request a new OTP.' }, { status: 400 })

  // Check block
  if (token.blockedUntil && token.blockedUntil > new Date()) {
    const mins = Math.ceil((token.blockedUntil.getTime() - Date.now()) / 60000)
    return NextResponse.json({ error: `Too many wrong attempts. Try again in ${mins} minutes.` }, { status: 429 })
  }

  // Check expiry
  if (token.expiresAt < new Date()) {
    await db.otpToken.delete({ where: { id: token.id } })
    return NextResponse.json({ error: 'OTP expired. Please request a new one.' }, { status: 400 })
  }

  if (token.emailOtp !== emailOtp) {
    const newAttempts = token.attempts + 1
    const shouldBlock = newAttempts >= MAX_ATTEMPTS
    await db.otpToken.update({
      where: { id: token.id },
      data: {
        attempts: newAttempts,
        ...(shouldBlock && { blockedUntil: new Date(Date.now() + BLOCK_MINUTES * 60 * 1000) }),
      },
    })
    if (shouldBlock) return NextResponse.json({ error: `Too many wrong attempts. Try again in ${BLOCK_MINUTES} minutes.` }, { status: 429 })
    return NextResponse.json({ error: 'Invalid OTP. Please try again.' }, { status: 400 })
  }

  // Mark verified so reset-password can proceed
  await db.otpToken.update({ where: { id: token.id }, data: { verified: true } })

  return NextResponse.json({ success: true, message: 'OTP verified successfully.' })
}
