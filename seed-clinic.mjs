import { PrismaClient } from './node_modules/.prisma/client/index.js'

const db = new PrismaClient()

const region = await db.region.findFirst()
if (!region) { console.log('No regions found'); process.exit(1) }
console.log('Region:', region.id, region.name)

const existing = await db.clinic.findMany({ take: 5, where: { isActive: true } })
console.log('Active clinics:', existing.length)

if (existing.length > 0) {
  console.log('Clinic already exists:', existing[0].id, existing[0].name)
  await db.$disconnect()
  process.exit(0)
}

const clinic = await db.clinic.create({
  data: {
    name: 'Test Clinic Delhi',
    address: '123 Test Street, New Delhi - 110001',
    contactPerson: 'Dr. Test Kumar',
    contactNumber: '9999999999',
    regionId: region.id,
    isActive: true,
  }
})
console.log('Created clinic:', clinic.id, clinic.name)
await db.$disconnect()
