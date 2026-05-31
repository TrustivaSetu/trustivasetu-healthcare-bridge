import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendEmail, otpEmailHtml } from '@/lib/email'

const MAX_ATTEMPTS = 5
const BLOCK_MINUTES = 15

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  const normalizedEmail = email.toLowerCase().trim()

  // Security: always return same message regardless of whether email exists
  const user = await db.user.findUnique({ where: { email: normalizedEmail } })
  const GENERIC_MSG = 'If this email is registered, an OTP has been sent to it.'

  if (!user || !user.isActive) {
    return NextResponse.json({ success: true, message: GENERIC_MSG })
  }

  // Check for active block
  const existing = await db.otpToken.findFirst({
    where: { email: normalizedEmail, purpose: 'PASSWORD_RESET', verified: false },
    orderBy: { createdAt: 'desc' },
  })

  if (existing?.blockedUntil && existing.blockedUntil > new Date()) {
    const mins = Math.ceil((existing.blockedUntil.getTime() - Date.now()) / 60000)
    return NextResponse.json({ error: `Too many attempts. Try again in ${mins} minutes.` }, { status: 429 })
  }

  // Invalidate old tokens for this email
  await db.otpToken.deleteMany({ where: { email: normalizedEmail, purpose: 'PASSWORD_RESET' } })

  const otp = generateOtp()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

  await db.otpToken.create({
    data: { email: normalizedEmail, emailOtp: otp, expiresAt, purpose: 'PASSWORD_RESET' },
  })

  await sendEmail({
    to: normalizedEmail,
    subject: `Password Reset OTP — Trustiva Setu LMS`,
    html: otpEmailHtml(otp, 'Password Reset'),
  })

  // Dev: include OTP in response
  return NextResponse.json({
    success: true,
    message: GENERIC_MSG,
    ...(process.env.NODE_ENV === 'development' ? { _devOtp: otp } : {}),
  })
}
