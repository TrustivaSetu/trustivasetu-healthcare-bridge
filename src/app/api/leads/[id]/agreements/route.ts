import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { canAccessLeadById } from '@/lib/lead-access'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = await context.params
  const { role, regionIds, clinicIds } = session.user
  if (!await canAccessLeadById(params.id, role, regionIds, clinicIds)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const agreements = await db.leadAgreement.findMany({
    where: { leadId: params.id },
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { version: 'desc' },
  })

  return NextResponse.json({ data: agreements })
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = await context.params
  const { role, regionIds, clinicIds } = session.user
  if (!await canAccessLeadById(params.id, role, regionIds, clinicIds)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { agreementUrl, fileName, notes } = await req.json()
  if (!agreementUrl) return NextResponse.json({ error: 'agreementUrl is required' }, { status: 400 })

  // Deactivate all previous active versions
  await db.leadAgreement.updateMany({
    where: { leadId: params.id, isActive: true },
    data: { isActive: false },
  })

  // Get next version number
  const latest = await db.leadAgreement.findFirst({
    where: { leadId: params.id },
    orderBy: { version: 'desc' },
    select: { version: true },
  })
  const nextVersion = (latest?.version ?? 0) + 1

  const agreement = await db.leadAgreement.create({
    data: {
      leadId: params.id,
      agreementUrl,
      fileName: fileName ?? null,
      notes: notes?.trim() || null,
      version: nextVersion,
      isActive: true,
      uploadedById: session.user.id,
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
  })

  // Keep agreementSigned flag in sync
  await db.lead.update({
    where: { id: params.id },
    data: { agreementSigned: true },
  })

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'CREATE',
      entity: 'LeadAgreement',
      entityId: agreement.id,
      details: `Uploaded agreement v${nextVersion} for lead ${params.id.slice(-8).toUpperCase()}`,
    },
  })

  return NextResponse.json({ data: agreement }, { status: 201 })
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const params = await context.params
  const { role, regionIds, clinicIds } = session.user
  if (!await canAccessLeadById(params.id, role, regionIds, clinicIds)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { searchParams } = new URL(req.url)
  const agreementId = searchParams.get('agreementId')
  if (!agreementId) return NextResponse.json({ error: 'agreementId required' }, { status: 400 })

  const existing = await db.leadAgreement.findFirst({ where: { id: agreementId, leadId: params.id } })
  if (!existing) return NextResponse.json({ error: 'Agreement not found' }, { status: 404 })

  await db.leadAgreement.delete({ where: { id: agreementId } })

  // If we deleted the active version, activate the previous one
  if (existing.isActive) {
    const prev = await db.leadAgreement.findFirst({
      where: { leadId: params.id },
      orderBy: { version: 'desc' },
    })
    if (prev) {
      await db.leadAgreement.update({ where: { id: prev.id }, data: { isActive: true } })
    } else {
      // No more agreements — unset agreementSigned flag
      await db.lead.update({ where: { id: params.id }, data: { agreementSigned: false } })
    }
  }

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'DELETE',
      entity: 'LeadAgreement',
      entityId: agreementId,
      details: `Deleted agreement v${existing.version} for lead ${params.id.slice(-8).toUpperCase()}`,
    },
  })

  return NextResponse.json({ success: true })
}
