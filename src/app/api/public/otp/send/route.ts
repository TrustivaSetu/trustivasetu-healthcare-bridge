import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendOtpSms } from '@/lib/sms'
import { checkOtpSendRateLimit } from '@/lib/rate-limit'

const isBypass = () => true // TESTING MODE - always bypass

export async function POST(req: NextRequest) {
  const { phone } = await req.json()

  if (!phone || !/^\d{10}$/.test(phone)) {
    return NextResponse.json({ error: 'Valid 10-digit phone number required' }, { status: 400 })
  }

  // TESTING MODE — return immediately, skip all DB calls and SMS
  if (isBypass()) {
    return NextResponse.json({ success: true, _devOtp: '123456' })
  }

  const rateLimit = await checkOtpSendRateLimit(phone)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many OTP requests. Please wait 5 minutes before trying again.' },
      { status: 429 },
    )
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

  await db.otpToken.deleteMany({ where: { email: `pub_${phone}`, purpose: 'PUBLIC_PHONE_OTP' } })
  await db.otpToken.create({
    data: { email: `pub_${phone}`, emailOtp: otp, purpose: 'PUBLIC_PHONE_OTP', expiresAt },
  })

  const result = await sendOtpSms(phone, otp)
  if (!result.success) {
    return NextResponse.json({ error: result.error ?? 'Failed to send OTP. Please try again.' }, { status: 503 })
  }

  return NextResponse.json({ success: true })
}
