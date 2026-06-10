// src/app/api/clinics/[id]/schemes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const schemeSchema = z.object({
  schemeTemplateId: z.string(),
  hospitalSubventionPct: z.number().min(0).max(100),
  subventionGstType: z.enum(['INCLUDED', 'EXCLUDED']),
  gstOnSubvention: z.number().default(18),
  processingFeePct: z.number().min(0).max(10).default(0),
  processingFeeGstType: z.enum(['INCLUDED', 'EXCLUDED']),
  gstOnPF: z.number().default(18),
})

// GET — clinic ke schemes
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const schemes = await db.clinicScheme.findMany({
    where: { clinicId: params.id, isActive: true },
    include: { schemeTemplate: true },
    orderBy: { schemeTemplate: { tenure: 'asc' } },
  })
  return NextResponse.json({ data: schemes })
}

// POST — add scheme to clinic
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = schemeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })
  }

  const d = parsed.data

  // Calculate total subvention
  let totalSubventionPct: number
  if (d.subventionGstType === 'EXCLUDED') {
    totalSubventionPct = d.hospitalSubventionPct * (1 + d.gstOnSubvention / 100)
  } else {
    totalSubventionPct = d.hospitalSubventionPct // GST already included
  }

  const scheme = await db.clinicScheme.upsert({
    where: {
      clinicId_schemeTemplateId: {
        clinicId: params.id,
        schemeTemplateId: d.schemeTemplateId,
      },
    },
    update: {
      hospitalSubventionPct: d.hospitalSubventionPct,
      subventionGstType: d.subventionGstType,
      gstOnSubvention: d.gstOnSubvention,
      totalSubventionPct,
      processingFeePct: d.processingFeePct,
      processingFeeGstType: d.processingFeeGstType,
      gstOnPF: d.gstOnPF,
      isActive: true,
    },
    create: {
      clinicId: params.id,
      schemeTemplateId: d.schemeTemplateId,
      hospitalSubventionPct: d.hospitalSubventionPct,
      subventionGstType: d.subventionGstType,
      gstOnSubvention: d.gstOnSubvention,
      totalSubventionPct,
      processingFeePct: d.processingFeePct,
      processingFeeGstType: d.processingFeeGstType,
      gstOnPF: d.gstOnPF,
    },
    include: { schemeTemplate: true },
  })

  return NextResponse.json({ data: scheme }, { status: 201 })
}

// DELETE — remove scheme
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { schemeId } = await req.json()
  await db.clinicScheme.update({
    where: { id: schemeId },
    data: { isActive: false },
  })
  return NextResponse.json({ success: true })
}