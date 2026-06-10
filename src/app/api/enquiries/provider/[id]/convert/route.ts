import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { sendEmail, portalAccessEmailHtml, clinicCreatorEmailHtml, clinicManagerEmailHtml } from '@/lib/email'

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  try {
    const enquiry = await db.providerEnquiry.findUnique({ where: { id } })
    if (!enquiry) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (enquiry.status === 'CONVERTED') {
      return NextResponse.json({ error: 'Already converted' }, { status: 400 })
    }

    // Validate required fields
    const missing: string[] = []
    if (!enquiry.clinicName) missing.push('clinicName')
    if (!enquiry.mobile && !enquiry.email) missing.push('mobile or email')
    if (!enquiry.city && !enquiry.pinCode) missing.push('city or pinCode')
    if (missing.length > 0) {
      return NextResponse.json({ error: 'Missing required fields', fields: missing }, { status: 400 })
    }

    // Resolve region record
    const regionName = enquiry.assignedRegion ?? enquiry.region
    if (!regionName) {
      return NextResponse.json({ error: 'Assign a region before converting' }, { status: 400 })
    }

    const regionRec = await db.region.findFirst({
      where: { name: { equals: regionName, mode: 'insensitive' } },
    })
    if (!regionRec) {
      return NextResponse.json({ error: 'Assign a region before converting' }, { status: 400 })
    }

    // Prepare portal user password
    let plainPassword: string | null = null
    let hashedPassword: string | null = null
    if (enquiry.email) {
      plainPassword = generatePassword(12)
      hashedPassword = await bcrypt.hash(plainPassword, 12)
    }

    // Transaction: create clinic + portal user
    const { clinic, portalUser } = await db.$transaction(async (tx) => {
      const clinic = await tx.clinic.create({
        data: {
          name: enquiry.clinicName!,
          address: enquiry.address ?? enquiry.city ?? '',
          contactPerson: enquiry.contactPerson ?? '',
          contactNumber: enquiry.mobile ?? '',
          email: enquiry.email ?? null,
          regionId: regionRec.id,
          assignedRMId: enquiry.assignedRmId ?? null,
          externalId: generateClinicCode(),
          metadata: {
            ifscCode: enquiry.ifscCode,
            bankName: enquiry.bankName,
            branchName: enquiry.branchName,
            accountNumber: enquiry.accountNumber,
            pincode: enquiry.pinCode,
            city: enquiry.city,
            state: enquiry.state,
            treatmentTypes: enquiry.treatmentTypes,
          },
        },
        include: { region: true },
      })

      let portalUser: { email: string } | null = null
      if (clinic.email && hashedPassword) {
        const conflict = await tx.user.findUnique({
          where: { email: clinic.email.toLowerCase() },
          select: { id: true },
        })
        const userEmail = conflict
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

    // Send 3 emails in parallel
    if (portalUser && plainPassword && enquiry.email) {
      const loginUrl = `${process.env.NEXTAUTH_URL ?? 'https://lms.trustivasetu.com'}/lms/login`
      const creator = await db.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, email: true, reportingManagerId: true },
      })
      const manager = creator?.reportingManagerId
        ? await db.user.findUnique({
            where: { id: creator.reportingManagerId },
            select: { name: true, email: true },
          })
        : null

      await Promise.allSettled([
        sendEmail({
          to: enquiry.email,
          subject: `Your Trustiva Setu Portal Access — ${enquiry.clinicName}`,
          html: portalAccessEmailHtml({
            clinicName: enquiry.clinicName!,
            email: portalUser.email,
            password: plainPassword,
            loginUrl,
          }),
        }),
        creator
          ? sendEmail({
              to: creator.email,
              subject: `Clinic Onboarded — ${enquiry.clinicName}`,
              html: clinicCreatorEmailHtml({
                clinicName: enquiry.clinicName!,
                creatorName: creator.name,
                portalEmail: portalUser.email,
                password: plainPassword,
                loginUrl,
              }),
            })
          : Promise.resolve(null),
        manager
          ? sendEmail({
              to: manager.email,
              subject: `New Clinic Onboarded — ${enquiry.clinicName}`,
              html: clinicManagerEmailHtml({
                clinicName: enquiry.clinicName!,
                managerName: manager.name,
                creatorName: creator!.name,
                loginUrl,
              }),
            })
          : Promise.resolve(null),
      ])
    }

    // Update enquiry
    await db.providerEnquiry.update({
      where: { id },
      data: { status: 'CONVERTED', convertedClinicId: clinic.id },
    })

    // Audit log
    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CONVERT',
        entity: 'ProviderEnquiry',
        entityId: id,
        details: `Converted to clinic ${clinic.id}`,
      },
    })

    return NextResponse.json({ clinicId: clinic.id, message: 'Converted to centre' })
  } catch (e) {
    console.error('[POST /api/enquiries/provider/:id/convert]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
