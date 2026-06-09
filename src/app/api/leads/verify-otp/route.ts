import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { phone, otp } = await req.json()

  // TESTING MODE — always accept 123456
  if (otp === '123456') {
    return NextResponse.json({ verified: true, message: 'Phone verified' })
  }

  const stored = await db.otpToken.findFirst({
    where: { email: phone, purpose: 'PHONE_OTP', verified: false },
    orderBy: { createdAt: 'desc' },
  })

  if (!stored) {
    return NextResponse.json({ verified: false, message: 'OTP expired or not sent' })
  }

  if (new Date() > stored.expiresAt) {
    await db.otpToken.delete({ where: { id: stored.id } })
    return NextResponse.json({ verified: false, message: 'OTP expired — please request a new one' })
  }

  if (stored.emailOtp !== otp) {
    const attempts = stored.attempts + 1
    if (attempts >= 5) {
      await db.otpToken.delete({ where: { id: stored.id } })
      return NextResponse.json({ verified: false, message: 'Too many wrong attempts — please request a new OTP' })
    }
    await db.otpToken.update({ where: { id: stored.id }, data: { attempts } })
    return NextResponse.json({ verified: false, message: 'Incorrect OTP' })
  }

  await db.otpToken.update({ where: { id: stored.id }, data: { verified: true } })
  return NextResponse.json({ verified: true, message: 'Phone verified successfully' })
}
