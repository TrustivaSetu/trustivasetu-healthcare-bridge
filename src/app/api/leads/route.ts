import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { buildClinicFilter, hasPermission } from '@/lib/permissions'
import { checkRolePermission } from '@/lib/role-permissions'
import { z } from 'zod'

const createSchema = z.object({
  applicantName: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  amount: z.number().positive(),
  clinicId: z.string().cuid(),
  lenderId: z.string().cuid().optional().or(z.literal('')),
  applicationDate: z.string().optional(),
  remarks: z.string().optional(),
  externalId: z.string().optional(),
  treatmentName: z.string().optional(),
  status: z.string().optional(),
  approvedAmount: z.number().optional(),
  disbursedAmount: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
  treatmentCategory: z.string().optional(),
  rejectionReason: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await checkRolePermission(session.user.role as string, 'LEADS', 'VIEW')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const clinicId = searchParams.get('clinicId')
  const regionId = searchParams.get('regionId')
  const lenderId = searchParams.get('lenderId')
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const page = parseInt(searchParams.get('page') ?? '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '20'), 100)

  const { role, regionIds, clinicIds } = session.user

  try {
    let clinicFilter = buildClinicFilter(role, regionIds, clinicIds)
    if (regionId) clinicFilter = { ...clinicFilter, regionId }
    if (clinicId) clinicFilter = { id: clinicId }

    const where: Record<string, unknown> = {}

    // SUPER_ADMIN and ADMIN see all leads; only scope for restricted roles
    const isUnrestricted = (role === 'SUPER_ADMIN' || role === 'ADMIN') && !regionId && !clinicId
    if (!isUnrestricted) {
      const validClinics = await db.clinic.findMany({ where: { ...clinicFilter, isActive: true }, select: { id: true } })
      where.clinicId = { in: validClinics.map(c => c.id) }
    }
    if (lenderId) where.lenderId = lenderId
    if (status) where.status = status
    if (dateFrom || dateTo) {
      where.applicationDate = {}
      if (dateFrom) (where.applicationDate as Record<string, unknown>).gte = new Date(dateFrom)
      if (dateTo) (where.applicationDate as Record<string, unknown>).lte = new Date(dateTo + 'T23:59:59')
    }
    if (search) where.applicantName = { contains: search, mode: 'insensitive' }

    const [total, leads] = await Promise.all([
      db.lead.count({ where }),
      db.lead.findMany({
        where,
        include: {
          clinic: { select: { id: true, name: true, region: { select: { id: true, name: true } } } },
          lender: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
        },
        orderBy: { applicationDate: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ])

    return NextResponse.json({ data: leads, total, page, pageSize })
  } catch (e) {
    console.error('[GET /api/leads]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, 'LEAD_CREATE')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!await checkRolePermission(session.user.role as string, 'LEADS', 'CREATE')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data
  const VALID_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'DISBURSED', 'CANCELLED']

  try {
    const createData = {
      applicantName: d.applicantName,
      phone: d.phone,
      email: d.email || null,
      amount: d.amount,
      clinicId: d.clinicId,
      lenderId: d.lenderId || null,
      applicationDate: d.applicationDate ? new Date(d.applicationDate) : new Date(),
      remarks: d.remarks,
      externalId: d.externalId,
      createdById: session.user.id,
      treatmentName: d.treatmentName,
      treatmentCategory: d.treatmentCategory,
      rejectionReason: d.rejectionReason,
      status: d.status && VALID_STATUSES.includes(d.status)
        ? d.status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISBURSED' | 'CANCELLED'
        : 'PENDING' as const,
      approvedAmount: d.approvedAmount ?? null,
      disbursedAmount: d.disbursedAmount ?? null,
      metadata: d.metadata ? JSON.parse(JSON.stringify(d.metadata)) : undefined,
    }
    const lead = await db.lead.create({
      data: createData,
      include: { clinic: { select: { id: true, name: true } }, lender: { select: { id: true, name: true } } },
    })

    await db.auditLog.create({ data: { userId: session.user.id, action: 'CREATE', entity: 'Lead', entityId: lead.id } })
    return NextResponse.json({ data: lead }, { status: 201 })
  } catch (e) {
    console.error('[POST /api/leads]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
