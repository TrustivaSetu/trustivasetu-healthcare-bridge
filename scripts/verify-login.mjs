/**
 * Diagnostic: verify a user account exists in the database.
 * Usage: node scripts/verify-login.mjs [email]
 * Does NOT print or compare passwords — use the portal UI to change credentials.
 */
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
const email = process.argv[2] ?? 'admin@trustivasetu.com'
const u = await db.user.findUnique({ where: { email } })

if (u) {
  console.log(`✓ User found: ${u.name} (${u.email}) — role: ${u.role} — active: ${u.isActive}`)
  console.log('  Password hash present:', Boolean(u.password))
  console.log('  Use the portal Change Password UI or Forgot Password flow to update credentials.')
} else {
  console.log(`✗ No user found for: ${email}`)
  console.log('  Run: npm run db:seed  to create the Super Admin account.')
}

await db.$disconnect()
