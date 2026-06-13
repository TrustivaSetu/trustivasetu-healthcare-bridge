import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { sendEmail, welcomeEmailHtml } from '@/lib/email'

const createSchema = z.object({
  email: z.string().email().endsWith('@trustivasetu.com', { message: 'Must use @trustivasetu.com email' }),
  password: z.string().min(8),
  name: z.string().min(2),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'REGIONAL_MANAGER', 'TEAM_MEMBER']),
  phone: z.string().optional(),
  designation: z.string().optional(),
  reportingManagerId: z.string().nullable().optional(),
  regionIds: z.array(z.string()).optional(),
  clinicIds: z.array(z.string()).optional(),
})

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, 'USER_READ')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const minimal = searchParams.get('minimal') === '1'
  const role = searchParams.get('role')
  const search = searchParams.get('search')

  const where: Record<string, unknown> = {}
  if (role) where.role = role
  if (search) where.OR = [
    { name: { contains: search, mode: 'insensitive' } },
    { email: { contains: search, mode: 'insensitive' } },
  ]

  const page = parseInt(searchParams.get('page') ?? '1')
  const pageSize = Math.min(parseInt(searchParams.get('pageSize') ?? '50'), 200)

  if (minimal) {
    const users = await db.user.findMany({
      where: { ...where, isActive: true },
      select: {
        id: true,
        name: true,
        role: true,
        employeeProfile: { select: { designation: true } },
      },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json({
      data: users.map(u => ({
        id: u.id,
        name: u.name,
        role: u.role,
        designation: u.employeeProfile?.designation ?? null,
      })),
    })
  }

  try {
    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true, email: true, name: true, role: true, isActive: true,
          phone: true, createdAt: true, reportingManagerId: true,
          employeeProfile: { select: { designation: true } },
          reportingManager: {
            select: {
              id: true, name: true,
              employeeProfile: { select: { designation: true } },
            },
          },
          regionAssignments: { include: { region: { select: { id: true, name: true } } } },
          clinicAssignments: { include: { clinic: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      db.user.count({ where }),
    ])

    const data = users.map(u => ({
      ...u,
      designation: u.employeeProfile?.designation ?? null,
      reportingManager: u.reportingManager
        ? {
            id: u.reportingManager.id,
            name: u.reportingManager.name,
            designation: u.reportingManager.employeeProfile?.designation ?? null,
          }
        : null,
    }))
    return NextResponse.json({ data, total, page, pageSize })
  } catch (e) {
    console.error('[GET /api/users]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, 'USER_CREATE')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  // Only Super Admin can create SUPER_ADMIN users
  const body = await req.json()
  if (body.role === 'SUPER_ADMIN' && session.user.role !== 'SUPER_ADMIN')
    return NextResponse.json({ error: 'Only Super Admin can create Super Admin users' }, { status: 403 })

  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 })

  const d = parsed.data

  try {
    const exists = await db.user.findUnique({ where: { email: d.email.toLowerCase() } })
    if (exists) return NextResponse.json({ error: 'Email already in use' }, { status: 409 })

    const hash = await bcrypt.hash(d.password, 12)
    const user = await db.user.create({
      data: {
        email: d.email.toLowerCase(),
        password: hash,
        name: d.name,
        role: d.role,
        phone: d.phone,
        reportingManagerId: d.reportingManagerId || null,
        createdById: session.user.id,
        regionAssignments: d.regionIds?.length
          ? { create: d.regionIds.map(rid => ({ regionId: rid })) }
          : undefined,
        clinicAssignments: d.clinicIds?.length
          ? { create: d.clinicIds.map(cid => ({ clinicId: cid })) }
          : undefined,
      },
      select: { id: true, email: true, name: true, role: true, isActive: true, createdAt: true },
    })

    if (d.designation) {
      await db.employeeProfile.create({ data: { userId: user.id, designation: d.designation } })
    }

    await db.auditLog.create({ data: { userId: session.user.id, action: 'CREATE', entity: 'User', entityId: user.id } })

    void (async () => {
      try {
        const lmsUrl = process.env.NEXTAUTH_URL ?? 'https://lms.trustivasetu.com'
        await sendEmail({
          to: user.email,
          subject: `Welcome to Trustiva Setu LMS — Your Account is Ready`,
          html: welcomeEmailHtml({ name: user.name, email: user.email, role: user.role, loginUrl: `${lmsUrl}/lms/login` }),
        })
      } catch (e) { console.error('[Welcome Email]', e) }
    })()

    return NextResponse.json({ data: user }, { status: 201 })
  } catch (e) {
    console.error('[POST /api/users]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
