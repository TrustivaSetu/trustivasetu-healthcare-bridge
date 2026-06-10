import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: NextRequest, context: { params: Promise<{ clinicId: string }> }) {
  const params = await context.params
  const { clinicId } = params
  if (!clinicId) return NextResponse.json({ error: 'Clinic ID required' }, { status: 400 })

  const clinic = await db.clinic.findFirst({
    where: {
      isActive: true,
      OR: [{ externalId: clinicId }, { id: clinicId }],
    },
    select: { id: true, name: true, externalId: true, address: true },
  })

  if (!clinic) {
    return NextResponse.json(
      { error: 'Invalid Clinic ID. Please check with your healthcare provider.' },
      { status: 404 },
    )
  }

  return NextResponse.json({ data: clinic })
}
