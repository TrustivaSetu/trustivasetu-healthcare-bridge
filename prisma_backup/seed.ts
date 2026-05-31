import { PrismaClient, UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

/** Minimal bootstrap only — hospitals, leads, users come from LOS sync APIs */
async function main() {
  console.log('Seeding Trustiva LMS (reference data + admin login only)...')

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

  const pwd = await bcrypt.hash('Admin@123', 12)

await db.user.upsert({
  where: { email: 'admin@trustivasetu.com' },

  update: {
    password: pwd,
    isActive: true,
  },

  create: {
    email: 'admin@trustivasetu.com',
    password: pwd,
    name: 'Super Admin',
    role: UserRole.SUPER_ADMIN,
    isActive: true,
  },
})

  console.log('Seed complete (no demo hospitals/leads).')
  console.log('LMS login (until LOS users sync): admin@trustivasetu.com / Admin@123')
  console.log('Add hospitals, users, enquiries from LOS via sync APIs — see docs/LOS_INTEGRATION.md')
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
