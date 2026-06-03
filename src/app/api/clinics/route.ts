import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { buildClinicFilter, hasPermission } from '@/lib/permissions'
import { checkRolePermission } from '@/lib/role-permissions'
import { startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { sendEmail, portalAccessEmailHtml } from '@/lib/email'

function generateClinicCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'TSC-'
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

function generatePassword(length = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  let password = ''
  password += 'ABCDEFGHJKLMNPQRSTUVWXYZ'[Math.floor(Math.random() * 24)]
  password += 'abcdefghjkmnpqrstuvwxyz'[Math.floor(Math.random() * 23)]
  password += '23456789'[Math.floor(Math.random() * 8)]
  password += '!@#$%'[Math.floor(Math.random() * 5)]
  for (let i = password.length; i < length; i++) {
    password += chars[Math.floor(Math.random() * chars.length)]
  }
  return password.split('').sort(() => Math.random() - 0.5).join('')
}

const createSchema = z.object({
  name: z.string().min(2),
  address: z.string().min(5),
  accountNumber: z.string().optional(),
  contactPerson: z.string().min(2),
  contactNumber: z.string().min(10),
  email: z.string().email().optional().or(z.literal('')),
  businessPotential: z.number().optional(),
  regionId: z.string().cuid(),
  assignedRMId: z.string().cuid().optional().or(z.literal('')),
  externalId: z.string().optional(),
  hospitalType: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await checkRolePermission(session.user.role as string, 'CLINICS', 'VIEW')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const minimal = searchParams.get('minimal') === '1'
  const search = searchParams.get('search') ?? ''
  const regionId = searchParams.get('regionId')
  const page = parseInt(searchParams.get('page') ?? '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '20'), 100)

  const { role, regionIds, clinicIds } = session.user
  const clinicFilter: Record<string, unknown> = buildClinicFilter(role, regionIds, clinicIds)
  if (regionId) clinicFilter.regionId = regionId
  if (search) clinicFilter.name = { contains: search, mode: 'insensitive' }

  try {
  if (minimal) {
    const clinics = await db.clinic.findMany({
      where: { ...clinicFilter, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json({ data: clinics })
  }

  const [total, clinics] = await Promise.all([
    db.clinic.count({ where: { ...clinicFilter, isActive: true } }),
    db.clinic.findMany({
      where: { ...clinicFilter, isActive: true },
      include: { region: { select: { id: true, name: true } }, assignedRM: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ])

  const now = new Date()
  const mtdStart = startOfMonth(now)
  const prevStart = startOfMonth(subMonths(now, 1))
  const prevEnd = endOfMonth(subMonths(now, 1))
  const pageClinicIds = clinics.map(c => c.id)

  const [totalGroups, mtdGroups, lmtdGroups, totalDisbGroups, mtdDisbGroups, lmtdDisbGroups, firstLeads] = await Promise.all([
    db.lead.groupBy({ by: ['clinicId'], where: { clinicId: { in: pageClinicIds } }, _count: { id: true } }),
    db.lead.groupBy({ by: ['clinicId'], where: { clinicId: { in: pageClinicIds }, applicationDate: { gte: mtdStart } }, _count: { id: true } }),
    db.lead.groupBy({ by: ['clinicId'], where: { clinicId: { in: pageClinicIds }, applicationDate: { gte: prevStart, lte: prevEnd } }, _count: { id: true } }),
    db.lead.groupBy({ by: ['clinicId'], where: { clinicId: { in: pageClinicIds }, status: 'DISBURSED' }, _sum: { disbursedAmount: true } }),
    db.lead.groupBy({ by: ['clinicId'], where: { clinicId: { in: pageClinicIds }, status: 'DISBURSED', disbursalDate: { gte: mtdStart } }, _sum: { disbursedAmount: true } }),
    db.lead.groupBy({ by: ['clinicId'], where: { clinicId: { in: pageClinicIds }, status: 'DISBURSED', disbursalDate: { gte: prevStart, lte: prevEnd } }, _sum: { disbursedAmount: true } }),
    db.lead.findMany({ where: { clinicId: { in: pageClinicIds } }, orderBy: { applicationDate: 'asc' }, distinct: ['clinicId'], select: { clinicId: true, applicationDate: true } }),
  ])

  const lookup = <T extends { clinicId: string }>(arr: T[], id: string): T | undefined => arr.find(x => x.clinicId === id)

  const clinicsWithStats = clinics.map(clinic => {
    const totalLeads = (lookup(totalGroups, clinic.id) as { _count: { id: number } } | undefined)?._count.id ?? 0
    const mtdLeads = (lookup(mtdGroups, clinic.id) as { _count: { id: number } } | undefined)?._count.id ?? 0
    const lmtdLeads = (lookup(lmtdGroups, clinic.id) as { _count: { id: number } } | undefined)?._count.id ?? 0
    const totalDisbursalValue = (lookup(totalDisbGroups, clinic.id) as { _sum: { disbursedAmount: number | null } } | undefined)?._sum.disbursedAmount ?? 0
    const mtdDisb = (lookup(mtdDisbGroups, clinic.id) as { _sum: { disbursedAmount: number | null } } | undefined)?._sum.disbursedAmount ?? 0
    const lmtdDisb = (lookup(lmtdDisbGroups, clinic.id) as { _sum: { disbursedAmount: number | null } } | undefined)?._sum.disbursedAmount ?? 0
    const firstLead = firstLeads.find(f => f.clinicId === clinic.id)

    return {
      ...clinic,
      totalLeads,
      mtdLeads,
      lmtdLeads,
      totalDisbursalValue,
      mtdDisbursalValue: mtdDisb,
      lmtdDisbursalValue: lmtdDisb,
      leadsGrowth: lmtdLeads > 0 ? ((mtdLeads - lmtdLeads) / lmtdLeads) * 100 : (mtdLeads > 0 ? 100 : 0),
      disbursalGrowth: lmtdDisb > 0 ? ((mtdDisb - lmtdDisb) / lmtdDisb) * 100 : (mtdDisb > 0 ? 100 : 0),
      firstLeadDate: firstLead?.applicationDate ?? null,
    }
  })

  return NextResponse.json({ data: clinicsWithStats, total, page, pageSize })
  } catch (e) {
    console.error('[GET /api/clinics]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, 'CLINIC_CREATE')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!await checkRolePermission(session.user.role as string, 'CLINICS', 'CREATE')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    const errors = parsed.error.flatten()
    console.error('[POST /api/clinics] Validation failed:', JSON.stringify(errors, null, 2))
    return NextResponse.json({ error: 'Validation failed', details: errors }, { status: 400 })
  }

  const data = parsed.data

  // Prepare portal user credentials outside transaction (bcrypt is I/O heavy)
  let plainPassword: string | null = null
  let hashedPassword: string | null = null
  if (data.email) {
    plainPassword = generatePassword(12)
    hashedPassword = await bcrypt.hash(plainPassword, 12)
  }

  try {
    const { clinic, portalUser } = await db.$transaction(async (tx) => {
      const clinic = await tx.clinic.create({
        data: {
          name: data.name,
          address: data.address,
          accountNumber: data.accountNumber,
          contactPerson: data.contactPerson,
          contactNumber: data.contactNumber,
          email: data.email || null,
          businessPotential: data.businessPotential,
          regionId: data.regionId,
          assignedRMId: data.assignedRMId || null,
          externalId: data.externalId || generateClinicCode(),
          hospitalType: data.hospitalType || null,
          metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : undefined,
        },
        include: { region: true, assignedRM: { select: { id: true, name: true } } },
      })

      // Auto-assign clinic to RM
      if (clinic.assignedRMId) {
        await tx.userClinic.upsert({
          where: { userId_clinicId: { userId: clinic.assignedRMId, clinicId: clinic.id } },
          create: { userId: clinic.assignedRMId, clinicId: clinic.id },
          update: {},
        })
      }

      // Auto-assign creating user if TEAM_MEMBER
      if (session.user.role === 'TEAM_MEMBER' && session.user.id !== clinic.assignedRMId) {
        await tx.userClinic.upsert({
          where: { userId_clinicId: { userId: session.user.id, clinicId: clinic.id } },
          create: { userId: session.user.id, clinicId: clinic.id },
          update: {},
        })
      }

      // Auto-create CLINIC_USER portal user if email provided
      let portalUser: { email: string } | null = null
      if (clinic.email && hashedPassword) {
        const emailConflict = await tx.user.findUnique({
          where: { email: clinic.email.toLowerCase() },
          select: { id: true },
        })
        const userEmail = emailConflict
          ? `portal+${clinic.id.slice(-6)}@trustivasetu.com`
          : clinic.email.toLowerCase()

        portalUser = await tx.user.create({
          data: {
            email: userEmail,
            password: hashedPassword,
            name: clinic.name,
            role: 'CLINIC_USER',
            mustChangePassword: true,
            clinicAssignments: { create: { clinicId: clinic.id } },
          },
          select: { email: true },
        })

        await tx.clinic.update({
          where: { id: clinic.id },
          data: { portalAccessSent: true, portalAccessSentAt: new Date() },
        })
      }

      return { clinic, portalUser }
    })

    // Send welcome email outside transaction
    if (portalUser && plainPassword && clinic.email) {
      const loginUrl = `${process.env.NEXTAUTH_URL ?? 'https://lms.trustivasetu.com'}/lms/login`
      try {
        await sendEmail({
          to: clinic.email,
          subject: `Your Trustiva Setu Portal Access — ${clinic.name}`,
          html: portalAccessEmailHtml({
            clinicName: clinic.name,
            email: portalUser.email,
            password: plainPassword,
            loginUrl,
          }),
        })
      } catch (emailErr) {
        console.error('[POST /api/clinics] Portal welcome email failed:', emailErr)
      }
    }

    await db.auditLog.create({ data: { userId: session.user.id, action: 'CREATE', entity: 'Clinic', entityId: clinic.id } })
    return NextResponse.json({ data: clinic, portalAccessSent: !!portalUser }, { status: 201 })
  } catch (e) {
    console.error('[POST /api/clinics]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
