import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { phone } = await req.json()
  if (!phone || !/^\d{10}$/.test(phone)) {
    return NextResponse.json({ error: 'Valid 10-digit phone required' }, { status: 400 })
  }

  // TESTING MODE — always use 123456, skip SMS entirely
  const otp = '123456'
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000)

  await db.otpToken.deleteMany({ where: { email: phone, purpose: 'PHONE_OTP' } })
  await db.otpToken.create({
    data: { email: phone, emailOtp: otp, purpose: 'PHONE_OTP', expiresAt },
  })

  return NextResponse.json({
    success: true,
    message: 'OTP sent',
    _devOtp: otp,
  })
}
