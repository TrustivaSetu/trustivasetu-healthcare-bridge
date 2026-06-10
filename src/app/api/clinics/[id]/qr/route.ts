import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import QRCode from 'qrcode'

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const clinic = await db.clinic.findUnique({
    where: { id: params.id },
    select: { id: true, externalId: true, name: true },
  })
  if (!clinic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const baseUrl = (process.env.NEXTAUTH_URL ?? 'https://lms.trustivasetu.com').replace(/\/$/, '')
  const clinicRef = clinic.externalId ?? clinic.id
  const qrUrl = `${baseUrl}/chat?clinic=${encodeURIComponent(clinicRef)}`

  const png = await QRCode.toBuffer(qrUrl, {
    type: 'png',
    width: 400,
    margin: 2,
    color: { dark: '#07111f', light: '#ffffff' },
  })

  const slug = (clinic.externalId ?? clinic.id).replace(/[^a-zA-Z0-9-]/g, '')

  return new NextResponse(png as unknown as BodyInit, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': `inline; filename="trustiva-qr-${slug}.png"`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
