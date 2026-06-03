import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const item = await db.recycleBin.findUnique({ where: { id: params.id } })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.recycleBin.delete({ where: { id: params.id } })
  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'DELETE',
      entity: 'RecycleBin',
      entityId: params.id,
      details: `Permanently deleted ${item.entityType} "${item.entityName}"`,
    },
  })

  return NextResponse.json({ success: true })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'SUPER_ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const item = await db.recycleBin.findUnique({ where: { id: params.id } })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const snapshot = item.snapshot as Record<string, unknown>

  try {
    if (item.entityType === 'User') {
      const exists = await db.user.findUnique({ where: { id: item.entityId }, select: { id: true } })
      if (exists) return NextResponse.json({ error: 'A user with this ID already exists' }, { status: 409 })

      await db.user.create({
        data: {
          id: item.entityId,
          email: snapshot.email as string,
          password: snapshot.password as string,
          name: snapshot.name as string,
          role: snapshot.role as 'SUPER_ADMIN' | 'ADMIN' | 'REGIONAL_MANAGER' | 'TEAM_MEMBER' | 'CLINIC_USER',
          isActive: false,
          phone: snapshot.phone as string | undefined,
        },
      })
    } else if (item.entityType === 'Lender') {
      const exists = await db.lender.findUnique({ where: { id: item.entityId }, select: { id: true } })
      if (exists) return NextResponse.json({ error: 'A lender with this ID already exists' }, { status: 409 })

      await db.lender.create({
        data: {
          id: item.entityId,
          name: snapshot.name as string,
          code: snapshot.code as string,
          isActive: false,
        },
      })
    } else if (item.entityType === 'Lead') {
      const exists = await db.lead.findUnique({ where: { id: item.entityId }, select: { id: true } })
      if (exists) return NextResponse.json({ error: 'A lead with this ID already exists' }, { status: 409 })

      const clinicExists = await db.clinic.findUnique({ where: { id: snapshot.clinicId as string }, select: { id: true } })
      if (!clinicExists) return NextResponse.json({ error: 'Original clinic no longer exists — cannot restore lead' }, { status: 409 })

      await db.lead.create({
        data: {
          id: item.entityId,
          applicantName: snapshot.applicantName as string,
          phone: snapshot.phone as string | undefined,
          email: snapshot.email as string | undefined,
          amount: snapshot.amount as number,
          status: snapshot.status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISBURSED' | 'CANCELLED',
          clinicId: snapshot.clinicId as string,
          approvedAmount: snapshot.approvedAmount as number | undefined,
          disbursedAmount: snapshot.disbursedAmount as number | undefined,
          utrNumber: snapshot.utrNumber as string | undefined,
          rejectionReason: snapshot.rejectionReason as string | undefined,
        },
      })
    } else if (item.entityType === 'Clinic') {
      const exists = await db.clinic.findUnique({ where: { id: item.entityId }, select: { id: true } })
      if (exists) return NextResponse.json({ error: 'A clinic with this ID already exists' }, { status: 409 })

      const regionExists = await db.region.findUnique({ where: { id: snapshot.regionId as string }, select: { id: true } })
      if (!regionExists) return NextResponse.json({ error: 'Original region no longer exists — cannot restore clinic' }, { status: 409 })

      await db.clinic.create({
        data: {
          id: item.entityId,
          name: snapshot.name as string,
          address: snapshot.address as string,
          contactPerson: snapshot.contactPerson as string,
          contactNumber: snapshot.contactNumber as string,
          email: snapshot.email as string | undefined,
          regionId: snapshot.regionId as string,
          isActive: false,
        },
      })
    } else {
      return NextResponse.json({ error: `Restore not supported for entity type: ${item.entityType}` }, { status: 400 })
    }

    await db.recycleBin.delete({ where: { id: params.id } })
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'RESTORE',
        entity: 'RecycleBin',
        entityId: item.entityId,
        details: `Restored ${item.entityType} "${item.entityName}"`,
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[recycle-bin restore]', err)
    return NextResponse.json({ error: 'Restore failed' }, { status: 500 })
  }
}
