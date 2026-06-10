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

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { role } = session.user
  if (role === 'CLINIC_USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params

  try {
    const clinic = await db.clinic.findUnique({ where: { id } })
    if (!clinic) return NextResponse.json({ error: 'Clinic not found' }, { status: 404 })

    // Find existing CLINIC_USER portal user
    const portalUser = await db.user.findFirst({
      where: { role: 'CLINIC_USER', clinicAssignments: { some: { clinicId: id } } },
      select: { id: true, email: true },
    })
    if (!portalUser) {
      return NextResponse.json({ error: 'No portal user found. Grant portal access from the clinic detail page first.' }, { status: 400 })
    }

    // Generate fresh password
    const plainPassword = generatePassword(12)
    const hashedPassword = await bcrypt.hash(plainPassword, 12)

    // Update portal user
    await db.user.update({ where: { id: portalUser.id }, data: { password: hashedPassword, mustChangePassword: true } })

    // Try send email to clinic
    let emailSent = false
    if (clinic.email) {
      try {
        const loginUrl = `${process.env.NEXTAUTH_URL ?? 'https://lms.trustivasetu.com'}/lms/login`
        await sendEmail({
          to: clinic.email,
          subject: `Your Updated Trustiva Setu Portal Credentials — ${clinic.name}`,
          html: portalAccessEmailHtml({ clinicName: clinic.name, email: portalUser.email, password: plainPassword, loginUrl }),
        })
        emailSent = true
      } catch (e) {
        console.error('[generate-credentials] email send failed:', e)
      }
    }

    // Update clinic fields
    const emailStatus = emailSent ? 'SENT' : (clinic.email ? 'FAILED' : 'NOT_SENT')
    await db.clinic.update({
      where: { id },
      data: {
        lastPasswordGenAt: new Date(),
        lastPasswordGenById: session.user.id,
        portalEmailStatus: emailStatus,
        portalAccessSent: true,
        ...(emailSent ? { portalAccessSentAt: new Date() } : {}),
      },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE',
        entity: 'Clinic',
        entityId: id,
        details: { action: 'generate_credentials', emailSent, portalEmail: portalUser.email },
      },
    })

    const generatedAt = new Date().toISOString()
    return NextResponse.json({
      success: true,
      clinicName: clinic.name,
      email: portalUser.email,
      plainPassword,
      emailSent,
      generatedAt,
      generatedBy: session.user.name,
    })
  } catch (e) {
    console.error('[POST /api/clinics/[id]/generate-credentials]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
