import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Mock OTP store (use Redis in production)
const OTP_STORE = new Map<string, { otp: string; expires: number }>()

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { phone } = await req.json()
  if (!phone || phone.length < 10) {
    return NextResponse.json({ error: 'Valid phone required' }, { status: 400 })
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expires = Date.now() + 5 * 60 * 1000 // 5 minutes

  // Store OTP
  OTP_STORE.set(phone, { otp, expires })

  // TODO: Replace with real SMS API (MSG91 / Setu)
  // For now — mock send, log to console in dev
  console.log(`[OTP] Phone: ${phone}, OTP: ${otp}`)

  // In production, use MSG91:
  // await fetch('https://api.msg91.com/api/v5/otp', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json', 'authkey': process.env.MSG91_AUTH_KEY! },
  //   body: JSON.stringify({ template_id: process.env.MSG91_TEMPLATE_ID, mobile: `91${phone}`, otp })
  // })

  return NextResponse.json({
    success: true,
    message: 'OTP sent',
    // Remove in production:
    _devOtp: process.env.NODE_ENV === 'development' ? otp : undefined,
  })
}