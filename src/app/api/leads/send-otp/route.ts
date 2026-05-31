import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { phone } = await req.json()
  if (!phone || phone.length < 10) {
    return NextResponse.json({ error: 'Valid phone required' }, { status: 400 })
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

  // Purge any existing OTPs for this phone, then create a fresh one
  await db.otpToken.deleteMany({ where: { email: phone, purpose: 'PHONE_OTP' } })
  await db.otpToken.create({
    data: { email: phone, emailOtp: otp, purpose: 'PHONE_OTP', expiresAt },
  })

  // TODO: Replace with real SMS API (MSG91 / Setu)
  console.log(`[OTP] Phone: ${phone}, OTP: ${otp}`)

  return NextResponse.json({
    success: true,
    message: 'OTP sent',
    _devOtp: process.env.NODE_ENV === 'development' ? otp : undefined,
  })
}
