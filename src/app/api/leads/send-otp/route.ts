import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { sendOtpSms } from '@/lib/msg91'

export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { phone } = await req.json()
  if (!phone || !/^\d{10}$/.test(phone)) {
    return NextResponse.json({ error: 'Valid 10-digit phone required' }, { status: 400 })
  }

  const isBypass = process.env.OTP_BYPASS === 'true'
  const otp = isBypass ? '123456' : String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

  await db.otpToken.deleteMany({ where: { email: phone, purpose: 'PHONE_OTP' } })
  await db.otpToken.create({
    data: { email: phone, emailOtp: otp, purpose: 'PHONE_OTP', expiresAt },
  })

  if (!isBypass) {
    try {
      await sendOtpSms(phone, otp)
    } catch (e) {
      console.error('[send-otp] SMS failed', e)
      return NextResponse.json({ error: 'Failed to send OTP via SMS. Please try again.' }, { status: 500 })
    }
  }

  return NextResponse.json({
    success: true,
    message: 'OTP sent',
    ...(isBypass && session.user.role === 'SUPER_ADMIN' ? { _devOtp: otp } : {}),
  })
}
