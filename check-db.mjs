import { PrismaClient } from './node_modules/.prisma/client/index.js'

const db = new PrismaClient()

const permCount = await db.rolePermission.count()
const clinicCount = await db.clinic.count({ where: { isActive: true } })
const userCount = await db.user.count()
const regionCount = await db.region.count()

console.log('RolePermissions:', permCount)
console.log('Active clinics:', clinicCount)
console.log('Users:', userCount)
console.log('Regions:', regionCount)

if (clinicCount > 0) {
  const clinics = await db.clinic.findMany({ where: { isActive: true }, select: { id: true, name: true, regionId: true } })
  console.log('Clinics:', clinics)
}

await db.$disconnect()
