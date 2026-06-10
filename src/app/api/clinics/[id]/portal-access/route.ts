import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { sendEmail, portalAccessEmailHtml } from '@/lib/email'

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

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const clinic = await db.clinic.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, email: true, portalAccessSent: true, portalAccessSentAt: true },
  })
  if (!clinic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const portalUser = await db.user.findFirst({
    where: { role: 'CLINIC_USER', clinicAssignments: { some: { clinicId: params.id } } },
    select: { id: true, email: true, name: true, isActive: true, mustChangePassword: true },
  })

  return NextResponse.json({ data: { clinic, portalUser } })
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const clinic = await db.clinic.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, email: true },
  })
  if (!clinic) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!clinic.email) {
    return NextResponse.json({ error: 'Clinic has no email address configured' }, { status: 400 })
  }

  const plainPassword = generatePassword(12)
  const hashed = await bcrypt.hash(plainPassword, 12)

  const portalEmail = clinic.email.toLowerCase()

  const existing = await db.user.findFirst({
    where: { role: 'CLINIC_USER', clinicAssignments: { some: { clinicId: params.id } } },
  })

  let portalUser
  if (existing) {
    portalUser = await db.user.update({
      where: { id: existing.id },
      data: { password: hashed, mustChangePassword: true, isActive: true },
    })
  } else {
    const emailConflict = await db.user.findUnique({ where: { email: portalEmail }, select: { id: true } })
    const userEmail = emailConflict ? `portal+${params.id.slice(-6)}@trustivasetu.com` : portalEmail

    portalUser = await db.user.create({
      data: {
        email: userEmail,
        password: hashed,
        name: clinic.name,
        role: 'CLINIC_USER',
        mustChangePassword: true,
        clinicAssignments: { create: { clinicId: params.id } },
      },
    })
  }

  await db.clinic.update({
    where: { id: params.id },
    data: { portalAccessSent: true, portalAccessSentAt: new Date() },
  })

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
  } catch (err) {
    console.error('[portal-access POST] Email send failed:', err)
  }

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'CREATE',
      entity: 'PortalAccess',
      entityId: params.id,
      details: `Portal access created/reset for clinic ${clinic.name}`,
    },
  })

  return NextResponse.json({ success: true, email: portalUser.email, tempPassword: plainPassword })
}

// Reset portal password with a custom password provided by admin
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { password } = body
  if (!password || typeof password !== 'string' || password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const clinic = await db.clinic.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, email: true },
  })
  if (!clinic) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })

  const portalUser = await db.user.findFirst({
    where: { role: 'CLINIC_USER', clinicAssignments: { some: { clinicId: params.id } } },
  })
  if (!portalUser) {
    return NextResponse.json({ error: 'No portal user found for this clinic' }, { status: 404 })
  }

  const hashed = await bcrypt.hash(password, 12)
  await db.user.update({
    where: { id: portalUser.id },
    data: { password: hashed, mustChangePassword: false },
  })

  if (clinic.email) {
    const loginUrl = `${process.env.NEXTAUTH_URL ?? 'https://lms.trustivasetu.com'}/lms/login`
    try {
      await sendEmail({
        to: clinic.email,
        subject: `Password Reset — ${clinic.name} Portal`,
        html: portalAccessEmailHtml({
          clinicName: clinic.name,
          email: portalUser.email,
          password,
          loginUrl,
        }),
      })
    } catch (err) {
      console.error('[portal-access PATCH] Email send failed:', err)
    }
  }

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'UPDATE',
      entity: 'PortalAccess',
      entityId: params.id,
      details: `Password manually reset for clinic portal ${clinic.name}`,
    },
  })

  return NextResponse.json({ success: true })
}
