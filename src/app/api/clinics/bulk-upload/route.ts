import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'
import * as XLSX from 'xlsx'
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

export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role as string, 'CLINIC_CREATE')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const regionId = formData.get('regionId') as string
    const assignedRMId = formData.get('assignedRMId') as string | null
    const legalEntityName = formData.get('legalEntityName') as string
    const commonGst = formData.get('commonGst') as string | null
    const commonPan = formData.get('commonPan') as string | null
    const commonIfsc = formData.get('commonIfsc') as string | null
    const commonBankName = formData.get('commonBankName') as string | null
    const commonAccountNumber = formData.get('commonAccountNumber') as string | null
    const agreementUrl = formData.get('agreementUrl') as string | null

    if (!file) return NextResponse.json({ error: 'Excel file required' }, { status: 400 })
    if (!regionId) return NextResponse.json({ error: 'Region required' }, { status: 400 })
    if (!legalEntityName) return NextResponse.json({ error: 'Legal entity name required' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })

    const sheetName = workbook.SheetNames.includes('Clinics Data')
      ? 'Clinics Data'
      : workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { defval: '' })

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No data found in Excel file' }, { status: 400 })
    }

    const results: {
      success: string[]
      failed: { row: number; name: string; error: string }[]
      usersCreated: number
      emailsSent: number
    } = { success: [], failed: [], usersCreated: 0, emailsSent: 0 }

    const loginUrl = `${process.env.NEXTAUTH_URL ?? 'https://lms.trustivasetu.com'}/lms/login`

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNum = i + 2

      const name = String(row['clinic_name*'] || row['clinic_name'] || '').trim()
      const address = String(row['address*'] || row['address'] || '').trim()
      const contactPerson = String(row['contact_person*'] || row['contact_person'] || '').trim()
      const contactNumber = String(row['contact_number*'] || row['contact_number'] || '').trim()

      if (!name || !address || !contactPerson || !contactNumber) {
        results.failed.push({ row: rowNum, name: name || `Row ${rowNum}`, error: 'Required fields missing' })
        continue
      }

      const gstNumber = String(row['gst_number'] || commonGst || '').trim()
      const panNumber = String(row['pan_number'] || commonPan || '').trim()
      const ifscCode = String(row['ifsc_code'] || commonIfsc || '').trim()
      const bankName = String(row['bank_name'] || commonBankName || '').trim()
      const accountNumber = String(row['account_number'] || commonAccountNumber || '').trim()
      const email = String(row['email'] || '').trim()
      const pincode = String(row['pincode'] || '').trim()
      const businessPotential = parseFloat(String(row['business_potential_lakhs'] || '0')) || undefined
      const hospitalType = String(row['hospital_type'] || '').trim()
      const alternatePhone = String(row['alternate_phone'] || '').trim()

      try {
        // Pre-compute portal credentials outside DB operation
        let plainPassword: string | null = null
        let hashedPassword: string | null = null
        if (email) {
          plainPassword = generatePassword(12)
          hashedPassword = await bcrypt.hash(plainPassword, 12)
        }

        const { clinic, portalUserEmail } = await db.$transaction(async (tx) => {
          const clinic = await tx.clinic.create({
            data: {
              name,
              address,
              contactPerson,
              contactNumber,
              email: email || null,
              businessPotential,
              regionId,
              assignedRMId: assignedRMId || null,
              externalId: generateClinicCode(),
              hospitalType: hospitalType || null,
              metadata: {
                legalEntityName,
                gstNumber,
                panNumber,
                ifscCode,
                bankName,
                accountNumber,
                pincode,
                alternatePhone,
                agreementUrl: agreementUrl || '',
              },
            },
          })

          let portalUserEmail: string | null = null
          if (email && hashedPassword) {
            const emailConflict = await tx.user.findUnique({
              where: { email: email.toLowerCase() },
              select: { id: true },
            })
            const userEmail = emailConflict
              ? `portal+${clinic.id.slice(-6)}@trustivasetu.com`
              : email.toLowerCase()

            const portalUser = await tx.user.create({
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

            portalUserEmail = portalUser.email
          }

          return { clinic, portalUserEmail }
        })

        results.success.push(`${name} (${clinic.externalId})`)

        if (portalUserEmail) {
          results.usersCreated++
          // Send welcome email (don't fail the row if email fails)
          if (plainPassword) {
            try {
              await sendEmail({
                to: email,
                subject: `Your Trustiva Setu Portal Access — ${name}`,
                html: portalAccessEmailHtml({
                  clinicName: name,
                  email: portalUserEmail,
                  password: plainPassword,
                  loginUrl,
                }),
              })
              results.emailsSent++
            } catch (emailErr) {
              console.error(`[bulk-upload] Email failed for ${name}:`, emailErr)
            }
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        results.failed.push({ row: rowNum, name, error: msg.includes('Unique') ? 'Clinic already exists' : msg })
      }
    }

    await db.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'BULK_CREATE',
        entity: 'Clinic',
        details: `Bulk upload: ${results.success.length} created, ${results.usersCreated} portal users, ${results.failed.length} failed. Entity: ${legalEntityName}`,
      },
    })

    return NextResponse.json({
      message: `${results.success.length} clinics created, ${results.failed.length} failed`,
      created: results.success,
      failed: results.failed,
      total: rows.length,
      usersCreated: results.usersCreated,
      emailsSent: results.emailsSent,
    })
  } catch (e: unknown) {
    console.error('Bulk upload error:', e)
    return NextResponse.json({ error: 'Upload failed — please check the Excel format' }, { status: 500 })
  }
}
