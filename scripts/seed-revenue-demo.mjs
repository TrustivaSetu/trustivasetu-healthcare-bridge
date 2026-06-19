/**
 * One-off demo data for the Revenue Intelligence module (local only).
 * Populates extra hospitals, disbursed leads with varied disbursal dates
 * (so NPA age buckets fill), and lender rates. Idempotent-ish via guards.
 */
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

const regions = await db.region.findMany({ select: { id: true, name: true } })
const lenders = await db.lender.findMany({ select: { id: true, name: true } })
const user = await db.user.findFirst({ where: { role: 'SUPER_ADMIN' }, select: { id: true } })

// Deterministic pseudo-random (no Math.random — stable reruns)
let s = 12345
const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
const between = (lo, hi) => lo + Math.floor(rnd() * (hi - lo))

// 1. Hospitals (channel partners) across regions
const HOSPITALS = [
  'Apollo Speciality', 'Fortis Healthcare', 'Max Super Speciality',
  'Manipal Hospitals', 'Narayana Health', 'Medanta Medicity',
]
const existingClinics = await db.clinic.count()
if (existingClinics < 6) {
  for (let i = 0; i < HOSPITALS.length; i++) {
    const region = regions[i % regions.length]
    await db.clinic.create({
      data: {
        name: HOSPITALS[i],
        address: `${between(1, 200)} Health Avenue, ${region.name}`,
        contactPerson: `Dr. ${pick(['Sharma', 'Iyer', 'Khan', 'Reddy', 'Nair', 'Gupta'])}`,
        contactNumber: `98${between(10000000, 99999999)}`,
        regionId: region.id,
        hospitalType: pick(['Multi-Speciality', 'Dental', 'Eye Care', 'Orthopaedic']),
      },
    }).catch(() => {})
  }
  console.log('Hospitals seeded')
}

const clinics = await db.clinic.findMany({ select: { id: true } })

// 2. Disbursed leads with disbursal dates spread 0–150 days ago
const disbursedNow = await db.lead.count({ where: { status: 'DISBURSED' } })
if (disbursedNow < 20) {
  const NAMES = ['Rahul', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Anjali', 'Rohan', 'Meera', 'Karan', 'Divya', 'Arjun', 'Pooja']
  let n = 0
  for (let i = 0; i < 70; i++) {
    const daysAgo = between(0, 150)
    const disbursalDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
    const amount = between(50, 500) * 1000
    await db.lead.create({
      data: {
        applicantName: `${pick(NAMES)} ${pick(['Sharma', 'Verma', 'Singh', 'Patel', 'Rao'])}`,
        phone: `9${between(100000000, 999999999)}`,
        amount,
        approvedAmount: amount,
        disbursedAmount: amount,
        status: 'DISBURSED',
        clinicId: pick(clinics).id,
        lenderId: pick(lenders).id,
        createdById: user?.id,
        applicationDate: disbursalDate,
        disbursalDate,
        nachStatus: pick(['ACTIVE', 'ACTIVE', 'ACTIVE', 'BOUNCED']),
        treatmentCategory: pick(['Cardiology', 'Orthopaedics', 'Dental', 'Oncology', 'Ophthalmology']),
      },
    })
    n++
  }
  console.log(`Disbursed leads seeded: ${n}`)
}

// 3. Lender rates (agreed commission %)
const ratesNow = await db.lenderRate.count()
if (ratesNow === 0) {
  const RATES = { 'HDFC Bank': 3.5, 'ICICI Bank': 3.75, 'State Bank of India': 3.0, 'Bajaj Finance': 5.25, 'Axis Bank': 4.0, 'Kotak Mahindra': 4.5 }
  for (const l of lenders) {
    await db.lenderRate.create({
      data: {
        lenderId: l.id,
        agreedRatePct: RATES[l.name] ?? 4,
        createdById: user?.id,
        notes: 'Standard partner commission',
      },
    })
  }
  console.log('Lender rates seeded')
}

const summary = {
  clinics: await db.clinic.count(),
  disbursed: await db.lead.count({ where: { status: 'DISBURSED' } }),
  rates: await db.lenderRate.count(),
}
console.log('SUMMARY', JSON.stringify(summary))
await db.$disconnect()
