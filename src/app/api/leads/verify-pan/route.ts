import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'

export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { pan, name } = await req.json()

  if (!pan || pan.length !== 10) {
    return NextResponse.json({ verified: false, message: '10 character PAN required' })
  }

  // PAN format validation
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/
  if (!panRegex.test(pan)) {
    return NextResponse.json({ verified: false, message: 'Invalid PAN format' })
  }

  // TODO: Real PAN verify via Setu/Karza/SignDesk
  // For now — mock verify (format check only)
  console.log(`[PAN Verify] PAN: ${pan}, Name: ${name}`)

  return NextResponse.json({
    verified: true,
    name: name || 'As per PAN records',
    message: 'PAN format valid (mock verify)',
    _note: 'Real API: Setu PAN Verify — integrate when credentials available',
  })
}