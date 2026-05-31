import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { aadhaar } = await req.json()

  if (!aadhaar || aadhaar.length !== 12) {
    return NextResponse.json({ verified: false, message: '12 digit Aadhaar required' })
  }

  // Basic Verhoeff checksum validation
  const isValidAadhaar = /^[2-9]{1}[0-9]{11}$/.test(aadhaar)
  if (!isValidAadhaar) {
    return NextResponse.json({ verified: false, message: 'Invalid Aadhaar number format' })
  }

  // TODO: Real Aadhaar OTP verify via Setu
  console.log(`[Aadhaar Verify] Aadhaar: ${aadhaar.slice(0, 4)}XXXX${aadhaar.slice(8)}`)

  return NextResponse.json({
    verified: true,
    maskedAadhaar: `XXXX-XXXX-${aadhaar.slice(8)}`,
    message: 'Aadhaar format valid (mock verify)',
    _note: 'Real API: Setu Aadhaar OTP — integrate when credentials available',
  })
}