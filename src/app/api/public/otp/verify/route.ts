import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { phone, otp } = await req.json()

  if (!phone || !otp) return NextResponse.json({ verified: false, message: 'Missing fields' }, { status: 400 })

  // Dev bypass — active when NODE_ENV is not production OR ENABLE_OTP_BYPASS=true
  if ((process.env.NODE_ENV !== 'production' || process.env.ENABLE_OTP_BYPASS === 'true') && otp === '123456') {
    return NextResponse.json({ verified: true })
  }

  const stored = await db.otpToken.findFirst({
    where: { email: `pub_${phone}`, purpose: 'PUBLIC_PHONE_OTP', verified: false },
    orderBy: { createdAt: 'desc' },
  })

  if (!stored) return NextResponse.json({ verified: false, message: 'OTP expired or not found. Please resend.' })

  if (new Date() > stored.expiresAt) {
    await db.otpToken.delete({ where: { id: stored.id } })
    return NextResponse.json({ verified: false, message: 'OTP expired — please request a new one' })
  }

  if (stored.emailOtp !== otp) {
    const attempts = stored.attempts + 1
    if (attempts >= 5) {
      await db.otpToken.delete({ where: { id: stored.id } })
      return NextResponse.json({ verified: false, message: 'Too many attempts — please resend OTP' })
    }
    await db.otpToken.update({ where: { id: stored.id }, data: { attempts } })
    return NextResponse.json({ verified: false, message: 'Incorrect OTP' })
  }

  await db.otpToken.update({ where: { id: stored.id }, data: { verified: true } })
  return NextResponse.json({ verified: true })
}
