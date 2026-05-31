import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'

const OTP_STORE = new Map<string, { otp: string; expires: number }>()

export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { phone, otp } = await req.json()

  const stored = OTP_STORE.get(phone)

  // Mock verify — always pass in dev if OTP is "123456"
  if (process.env.NODE_ENV === 'development' && otp === '123456') {
    return NextResponse.json({ verified: true, message: 'Phone verified (dev mode)' })
  }

  if (!stored) {
    return NextResponse.json({ verified: false, message: 'OTP expired or not sent' })
  }

  if (Date.now() > stored.expires) {
    OTP_STORE.delete(phone)
    return NextResponse.json({ verified: false, message: 'OTP expire ho gaya — dobara bhejo' })
  }

  if (stored.otp !== otp) {
    return NextResponse.json({ verified: false, message: 'Galat OTP' })
  }

  OTP_STORE.delete(phone)
  return NextResponse.json({ verified: true, message: 'Phone verified successfully' })
}