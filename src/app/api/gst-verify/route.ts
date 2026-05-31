import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const gstin = searchParams.get('gstin')

  if (!gstin || gstin.length !== 15) {
    return NextResponse.json({ success: false, error: 'Invalid GSTIN — must be 15 characters' }, { status: 400 })
  }

  try {
    const res = await fetch(`https://gst.gov.in/commonapisvcs/gstnSearch/gstnInfo?gstin=${gstin}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    })

    if (res.ok) {
      const data = await res.json()
      if (data?.sts === 'Active') {
        const addr = data.pradr?.addr
        const address = [addr?.bnm, addr?.st, addr?.loc, addr?.stcd].filter(Boolean).join(', ')
        return NextResponse.json({
          success: true,
          legalName: data.lgnm ?? '',
          tradeName: data.tradeNam ?? '',
          address,
          pincode: addr?.pncd ?? '',
          status: data.sts,
        })
      }
    }

    return NextResponse.json({ success: false, error: 'GST number inactive or not found — please fill manually' })
  } catch {
    return NextResponse.json({ success: false, error: 'GST API unavailable — please fill manually' })
  }
}