import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
const db = new PrismaClient()
const pw = 'Demo@12345'
const hashed = await bcrypt.hash(pw, 12)
const u = await db.user.update({
  where: { email: 'admin@trustivasetu.com' },
  data: { password: hashed, mustChangePassword: false },
  select: { email: true, role: true },
})
console.log('Reset:', JSON.stringify(u), 'password=', pw)
await db.$disconnect()
