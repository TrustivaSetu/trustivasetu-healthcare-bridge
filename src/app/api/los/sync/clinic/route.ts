import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { losUnauthorized, verifyLosRequest } from '@/lib/los-auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  if (!verifyLosRequest(req)) return losUnauthorized()

  const body = await req.json() as Record<string, unknown>
  const name = String(body.fullName ?? body.identifierName ?? body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'Channel partner name required' }, { status: 400 })

  const externalId = body.externalId
    ? String(body.externalId)
    : `LOS-H-${name.replace(/\s+/g, '').slice(0, 12).toUpperCase()}`

  const regionCode = String(body.regionCode ?? 'SOUTH').toUpperCase()
  const region = await db.region.findUnique({ where: { code: regionCode } })
    ?? await db.region.findFirst()
  if (!region) return NextResponse.json({ error: 'No region configured in LMS' }, { status: 400 })

  const payload = {
    name,
    externalId,
    address: String(body.address ?? (`${body.locality ?? ''} ${body.city ?? ''} ${body.state ?? ''}`.trim() || name)),
    contactPerson: String(body.contactPerson ?? body.fullName ?? 'Hospital Admin'),
    contactNumber: String(body.phone ?? body.contactNumber ?? '0000000000'),
    email: body.email ? String(body.email) : null,
    accountNumber: body.accountNumber ? String(body.accountNumber) : body.accountNo ? String(body.accountNo) : null,
    businessPotential: body.businessPotential ? Number(body.businessPotential) : null,
    hospitalType: body.hospitalType ? String(body.hospitalType) : null,
    metadata: body as Prisma.InputJsonValue,
    regionId: region.id,
  }

  let assignedRMId: string | undefined
  const rmEmail = body.assignedRMEmail ?? body.rmEmail
  if (rmEmail) {
    const rm = await db.user.findUnique({ where: { email: String(rmEmail).toLowerCase() } })
    if (rm) assignedRMId = rm.id
  }

  const meta = { ...(body as object), source: 'los' }
  if (body.commercials ?? body.commercial) {
    Object.assign(meta, { commercials: body.commercials ?? body.commercial })
  }

  const data = {
    ...payload,
    metadata: meta as Prisma.InputJsonValue,
    isActive: body.isActive !== false,
    ...(assignedRMId ? { assignedRMId } : {}),
  }

  const existing = await db.clinic.findUnique({ where: { externalId } })
  const clinic = existing
    ? await db.clinic.update({ where: { id: existing.id }, data })
    : await db.clinic.create({ data })

  await db.auditLog.create({
    data: { action: existing ? 'UPDATE' : 'CREATE', entity: 'Clinic', entityId: clinic.id, details: '{"source":"los"}' },
  })

  return NextResponse.json({ success: true, action: existing ? 'updated' : 'created', clinicId: clinic.id })
}
