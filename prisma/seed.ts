import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

const db = new PrismaClient()

/** Minimal bootstrap — reference data + super admin account via env variable */
async function main() {
  console.log('Seeding Trustiva LMS (reference data only)...')

  await Promise.all([
    db.region.upsert({ where: { code: 'NORTH' }, update: {}, create: { name: 'North Region', code: 'NORTH' } }),
    db.region.upsert({ where: { code: 'SOUTH' }, update: {}, create: { name: 'South Region', code: 'SOUTH' } }),
    db.region.upsert({ where: { code: 'EAST' }, update: {}, create: { name: 'East Region', code: 'EAST' } }),
    db.region.upsert({ where: { code: 'WEST' }, update: {}, create: { name: 'West Region', code: 'WEST' } }),
  ])

  await Promise.all([
    db.lender.upsert({ where: { code: 'HDFC' }, update: {}, create: { name: 'HDFC Bank', code: 'HDFC' } }),
    db.lender.upsert({ where: { code: 'SBI' }, update: {}, create: { name: 'State Bank of India', code: 'SBI' } }),
    db.lender.upsert({ where: { code: 'ICICI' }, update: {}, create: { name: 'ICICI Bank', code: 'ICICI' } }),
    db.lender.upsert({ where: { code: 'AXIS' }, update: {}, create: { name: 'Axis Bank', code: 'AXIS' } }),
    db.lender.upsert({ where: { code: 'BAJAJ' }, update: {}, create: { name: 'Bajaj Finance', code: 'BAJAJ' } }),
    db.lender.upsert({ where: { code: 'KOTAK' }, update: {}, create: { name: 'Kotak Mahindra', code: 'KOTAK' } }),
  ])

  // Super Admin — only create if account does not yet exist.
  // Password is read from SUPER_ADMIN_PASSWORD env variable.
  // If env var is not set, a random secure password is generated and printed ONCE.
  // The update block intentionally never changes the password — use the Change Password
  // feature in the portal or the forgot-password flow to update credentials.
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL ?? 'admin@trustivasetu.com'
  const existing = await db.user.findUnique({ where: { email: superAdminEmail } })

  if (!existing) {
    const rawPassword = process.env.SUPER_ADMIN_PASSWORD ?? crypto.randomBytes(12).toString('base64url')
    const hashed = await bcrypt.hash(rawPassword, 12)

    await db.user.create({
      data: {
        email: superAdminEmail,
        password: hashed,
        name: 'Super Admin',
        role: UserRole.SUPER_ADMIN,
        isActive: true,
      },
    })

    if (!process.env.SUPER_ADMIN_PASSWORD) {
      console.log('═══════════════════════════════════════════════')
      console.log('  Super Admin account created for first time')
      console.log(`  Email   : ${superAdminEmail}`)
      console.log(`  Password: ${rawPassword}`)
      console.log('  SAVE THIS PASSWORD — it will not be shown again.')
      console.log('  Use the portal Change Password feature to update.')
      console.log('═══════════════════════════════════════════════')
    } else {
      console.log(`Super Admin account created: ${superAdminEmail}`)
    }
  } else {
    console.log(`Super Admin account already exists (${superAdminEmail}) — password unchanged.`)
  }

  console.log('Seed complete.')
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
