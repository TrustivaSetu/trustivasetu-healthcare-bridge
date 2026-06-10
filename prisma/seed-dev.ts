/**
 * Test data seed — creates realistic data for all features.
 * Run: npx tsx prisma/seed-dev.ts
 * Safe to re-run (uses upsert / skip-if-exists patterns).
 */
import { PrismaClient, UserRole, LeadStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { subDays, subHours, addHours } from 'date-fns'

const db = new PrismaClient()

// ── Helpers ───────────────────────────────────────────────────────────────────
function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }
function randAmount(min: number, max: number, step = 5000) {
  return Math.round(randInt(min / step, max / step) * step)
}

async function main() {
  console.log('🌱  Seeding test data...\n')

  // ── 1. Lenders (upsert all 6) ─────────────────────────────────────────────
  console.log('  Lenders...')
  const lenderData = [
    { name: 'HDFC Bank',        code: 'HDFC'  },
    { name: 'Bajaj Finance',    code: 'BAJAJ' },
    { name: 'ICICI Bank',       code: 'ICICI' },
    { name: 'Axis Bank',        code: 'AXIS'  },
    { name: 'Kotak Mahindra',   code: 'KOTAK' },
    { name: 'State Bank of India', code: 'SBI' },
  ]
  await Promise.all(
    lenderData.map(l => db.lender.upsert({ where: { code: l.code }, update: {}, create: { ...l, isActive: true } }))
  )
  const lenders = await db.lender.findMany({ where: { isActive: true } })

  // ── 2. Regions (create if missing, fix empty codes) ──────────────────────
  console.log('  Regions...')
  const regionData = [
    { name: 'Delhi NCR',    code: 'DELHI'     },
    { name: 'Mumbai',       code: 'MUMBAI'    },
    { name: 'Bengaluru',    code: 'BENGALURU' },
    { name: 'Hyderabad',    code: 'HYD'       },
    { name: 'Chennai',      code: 'CHENNAI'   },
  ]
  for (const r of regionData) {
    const existing = await db.region.findFirst({ where: { name: r.name } })
    if (!existing) {
      // Try creating; if code collides, skip
      await db.region.create({ data: { ...r, isActive: true } }).catch(() => {})
    } else if (!existing.code || existing.code.trim() === '') {
      // Fix empty code
      await db.region.update({ where: { id: existing.id }, data: { code: r.code } }).catch(() => {})
    }
  }
  const regions = await db.region.findMany({ where: { isActive: true } })

  // ── 3. Users (RM + Team members) ─────────────────────────────────────────
  console.log('  Users...')
  const superAdmin = await db.user.findFirst({ where: { role: 'SUPER_ADMIN' } })

  const rmPassword = await bcrypt.hash('Test@1234', 12)
  const rmUsers = [
    { email: 'rm.delhi@trustivasetu.com',     name: 'Arjun Sharma',    region: 'DELHI'     },
    { email: 'rm.mumbai@trustivasetu.com',    name: 'Priya Nair',      region: 'MUMBAI'    },
    { email: 'rm.bengaluru@trustivasetu.com', name: 'Kiran Reddy',     region: 'BENGALURU' },
  ]
  const createdRMs: Record<string, string> = {}
  for (const rm of rmUsers) {
    const region = regions.find(r => r.code === rm.region)!
    let user = await db.user.findUnique({ where: { email: rm.email } })
    if (!user) {
      user = await db.user.create({
        data: {
          email: rm.email, password: rmPassword, name: rm.name,
          role: UserRole.REGIONAL_MANAGER, isActive: true,
          createdById: superAdmin?.id,
          regionAssignments: { create: { regionId: region.id } },
          employeeProfile: { create: { designation: 'Regional Manager', department: 'Sales' } },
        },
      })
    }
    createdRMs[rm.region] = user.id
  }

  const tmPassword = await bcrypt.hash('Test@1234', 12)
  const tmUsers = [
    { email: 'tm.delhi1@trustivasetu.com',  name: 'Rahul Gupta',   region: 'DELHI'     },
    { email: 'tm.mumbai1@trustivasetu.com', name: 'Sneha Joshi',   region: 'MUMBAI'    },
  ]
  const createdTMs: string[] = []
  for (const tm of tmUsers) {
    const region = regions.find(r => r.code === tm.region)!
    let user = await db.user.findUnique({ where: { email: tm.email } })
    if (!user) {
      user = await db.user.create({
        data: {
          email: tm.email, password: tmPassword, name: tm.name,
          role: UserRole.TEAM_MEMBER, isActive: true,
          createdById: superAdmin?.id,
          reportingManagerId: createdRMs[tm.region],
          regionAssignments: { create: { regionId: region.id } },
          employeeProfile: { create: { designation: 'Relationship Manager', department: 'Sales' } },
        },
      })
    }
    createdTMs.push(user.id)
  }

  // ── 4. Clinics ────────────────────────────────────────────────────────────
  console.log('  Clinics...')
  const clinicData = [
    { name: 'Apollo Smile Dental', address: 'Connaught Place, New Delhi', region: 'DELHI',     type: 'Dental', rm: 'DELHI',     potential: 50 },
    { name: 'Vasan Eye Care',      address: 'Bandra West, Mumbai',        region: 'MUMBAI',    type: 'Ophthalmology', rm: 'MUMBAI', potential: 80 },
    { name: 'Fortis Hair Clinic',  address: 'Indiranagar, Bengaluru',     region: 'BENGALURU', type: 'Hair Transplant', rm: 'BENGALURU', potential: 40 },
    { name: 'Nova IVF Fertility',  address: 'Jubilee Hills, Hyderabad',   region: 'HYD',       type: 'IVF & Fertility', rm: 'DELHI', potential: 100 },
    { name: 'Manipal Orthopaedics',address: 'Anna Nagar, Chennai',        region: 'CHENNAI',   type: 'Orthopaedics', rm: 'MUMBAI', potential: 60 },
    { name: 'Pristine Cosmo Clinic',address: 'Sector 18, Noida',         region: 'DELHI',     type: 'Cosmetology', rm: 'DELHI', potential: 35 },
    { name: 'Cloudnine Fertility', address: 'Koramangala, Bengaluru',     region: 'BENGALURU', type: 'IVF & Fertility', rm: 'BENGALURU', potential: 75 },
  ]

  const clinics = []
  for (const c of clinicData) {
    const region = regions.find(r => r.code === c.region)!
    const assignedRMId = createdRMs[c.rm] ?? null
    const externalId = `TSC-${c.name.replace(/\s+/g, '').slice(0, 5).toUpperCase()}${randInt(100, 999)}`
    let clinic = await db.clinic.findFirst({ where: { name: c.name } })
    if (!clinic) {
      clinic = await db.clinic.create({
        data: {
          name: c.name, address: c.address, regionId: region.id,
          assignedRMId, externalId, hospitalType: c.type,
          businessPotential: c.potential, isActive: true,
          contactPerson: 'Dr. ' + c.name.split(' ')[0],
          contactNumber: `9${randInt(100000000, 999999999)}`,
          email: `info@${c.name.toLowerCase().replace(/\s+/g, '')}.com`,
          accountNumber: `${randInt(1000000000, 9999999999)}`,
          metadata: {
            gstNumber: `07AABCU9603R1ZV`,
            panNumber: `AABCU9603R`,
            ifscCode: 'HDFC0001234',
            bankName: 'HDFC Bank',
            pincode: `${randInt(110001, 110099)}`,
            signingAuthority: 'Dr. ' + c.name.split(' ')[0] + ' Founder',
          },
        },
      })
      // Auto-assign RM to clinic
      if (assignedRMId) {
        await db.userClinic.upsert({
          where: { userId_clinicId: { userId: assignedRMId, clinicId: clinic.id } },
          create: { userId: assignedRMId, clinicId: clinic.id },
          update: {},
        })
      }
    }
    clinics.push(clinic)
  }

  // ── 5. Clinic Schemes ─────────────────────────────────────────────────────
  console.log('  Clinic schemes...')
  const schemeTemplates = await db.schemeTemplate.findMany({ where: { isActive: true }, take: 6 })
  if (schemeTemplates.length > 0) {
    for (const clinic of clinics) {
      const existing = await db.clinicScheme.count({ where: { clinicId: clinic.id } })
      if (existing === 0) {
        const selectedSchemes = schemeTemplates.slice(0, 3)
        await Promise.all(
          selectedSchemes.map(st => {
            const hospitalPct = randInt(8, 14)
            const gstOnSub = 18
            const totalPct = parseFloat((hospitalPct * 1.18).toFixed(4))
            return db.clinicScheme.create({
              data: {
                clinicId: clinic.id, schemeTemplateId: st.id,
                hospitalSubventionPct: hospitalPct,
                gstOnSubvention: gstOnSub,
                subventionGstType: 'EXCLUDED',
                totalSubventionPct: totalPct,
                processingFeePct: 0,
                processingFeeGstType: 'EXCLUDED',
                gstOnPF: 18,
                isActive: true,
              },
            })
          })
        )
      }
    }
  }

  // ── 6. Leads ──────────────────────────────────────────────────────────────
  console.log('  Leads...')
  const existingLeads = await db.lead.count()
  if (existingLeads > 0) {
    console.log(`  Skipping — ${existingLeads} leads already exist`)
  } else {
    const createdById = superAdmin?.id ?? null
    const treatments: Array<{ category: string; name: string }> = [
      { category: 'Dental', name: 'Implants' },
      { category: 'Dental', name: 'Clear Aligners' },
      { category: 'Ophthalmology', name: 'LASIK' },
      { category: 'Ophthalmology', name: 'Cataract Surgery' },
      { category: 'Hair Transplant', name: 'FUE' },
      { category: 'IVF & Fertility', name: 'IVF' },
      { category: 'IVF & Fertility', name: 'IUI' },
      { category: 'Orthopaedics', name: 'Knee Replacement' },
      { category: 'Cosmetology & Aesthetics', name: 'Rhinoplasty' },
      { category: 'Cosmetology & Aesthetics', name: 'Liposuction' },
      { category: 'Bariatric', name: 'Gastric Bypass' },
      { category: 'General Surgery', name: 'Hernia Repair' },
    ]
    const firstNames = ['Rahul', 'Priya', 'Amit', 'Sunita', 'Vikram', 'Anita', 'Deepak', 'Kavya', 'Manoj', 'Rekha', 'Suresh', 'Pooja', 'Ajay', 'Meena', 'Nitin']
    const lastNames = ['Sharma', 'Patel', 'Singh', 'Kumar', 'Reddy', 'Nair', 'Verma', 'Gupta', 'Joshi', 'Mishra', 'Rao', 'Shah', 'Mehta', 'Yadav', 'Das']
    const employmentTypes = ['SALARIED', 'SALARIED', 'BUSINESS', 'SELF_EMPLOYED', 'OTHER'] as const

    interface LeadSpec {
      status: LeadStatus
      daysAgo: number
      approvalDaysAgo?: number
      disbursalDaysAgo?: number
    }

    const leadSpecs: LeadSpec[] = [
      // PENDING (5)
      { status: 'PENDING', daysAgo: 1 },
      { status: 'PENDING', daysAgo: 2 },
      { status: 'PENDING', daysAgo: 3 },
      { status: 'PENDING', daysAgo: 5 },
      { status: 'PENDING', daysAgo: 7 },
      // APPROVED (5)
      { status: 'APPROVED', daysAgo: 10, approvalDaysAgo: 8 },
      { status: 'APPROVED', daysAgo: 12, approvalDaysAgo: 10 },
      { status: 'APPROVED', daysAgo: 15, approvalDaysAgo: 13 },
      { status: 'APPROVED', daysAgo: 18, approvalDaysAgo: 15 },
      { status: 'APPROVED', daysAgo: 20, approvalDaysAgo: 17 },
      // DISBURSED (7)
      { status: 'DISBURSED', daysAgo: 25, approvalDaysAgo: 22, disbursalDaysAgo: 20 },
      { status: 'DISBURSED', daysAgo: 30, approvalDaysAgo: 27, disbursalDaysAgo: 24 },
      { status: 'DISBURSED', daysAgo: 35, approvalDaysAgo: 32, disbursalDaysAgo: 28 },
      { status: 'DISBURSED', daysAgo: 40, approvalDaysAgo: 37, disbursalDaysAgo: 33 },
      { status: 'DISBURSED', daysAgo: 45, approvalDaysAgo: 42, disbursalDaysAgo: 38 },
      { status: 'DISBURSED', daysAgo: 50, approvalDaysAgo: 47, disbursalDaysAgo: 43 },
      { status: 'DISBURSED', daysAgo: 55, approvalDaysAgo: 51, disbursalDaysAgo: 47 },
      // REJECTED (4)
      { status: 'REJECTED', daysAgo: 8 },
      { status: 'REJECTED', daysAgo: 14 },
      { status: 'REJECTED', daysAgo: 22 },
      { status: 'REJECTED', daysAgo: 28 },
      // CANCELLED (2)
      { status: 'CANCELLED', daysAgo: 6 },
      { status: 'CANCELLED', daysAgo: 16 },
    ]

    const rejectionReasons = [
      'CIBIL score below lender threshold',
      'Insufficient income documentation',
      'High existing EMI obligations (FOIR exceeded)',
      'Applicant withdrew — found alternative financing',
    ]

    let i = 0
    for (const spec of leadSpecs) {
      const treatment = rand(treatments)
      const clinic = rand(clinics)
      const lender = spec.status === 'PENDING' ? null : rand(lenders)
      const employmentType = rand([...employmentTypes])
      const monthlyIncome = randInt(20, 80) * 1000
      const loanAmount = randAmount(30000, 120000)
      const approvedAmount = spec.status !== 'PENDING' && spec.status !== 'CANCELLED'
        ? Math.round(loanAmount * (0.8 + Math.random() * 0.15))
        : null
      const disbursedAmount = spec.status === 'DISBURSED' ? approvedAmount : null
      const appDate = subDays(new Date(), spec.daysAgo)
      const approvalDate = spec.approvalDaysAgo ? subDays(new Date(), spec.approvalDaysAgo) : null
      const disbursalDate = spec.disbursalDaysAgo ? subDays(new Date(), spec.disbursalDaysAgo) : null
      const firstName = rand(firstNames)
      const lastName = rand(lastNames)
      const applicantName = `${firstName} ${lastName}`
      const tenure = rand([6, 9, 12, 18, 24])
      const emi = approvedAmount ? Math.round(approvedAmount / tenure) : null
      const processingFeePct = rand([0, 0, 1.5, 2])
      const processingFeeAmount = approvedAmount ? Math.round(approvedAmount * processingFeePct / 100) : 0
      const isNachDone = spec.status === 'DISBURSED'
      const isAgreementSigned = spec.status === 'DISBURSED' || spec.status === 'APPROVED'
      const utrNumber = spec.status === 'DISBURSED'
        ? `UTR${randInt(100000000000, 999999999999)}`
        : null

      await db.lead.create({
        data: {
          applicantName,
          phone: `9${randInt(100000000, 999999999)}`,
          email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@gmail.com`,

          amount: loanAmount,
          status: spec.status,
          approvedAmount,
          disbursedAmount,
          applicationDate: appDate,
          approvalDate,
          disbursalDate,
          clinicId: clinic.id,
          lenderId: lender?.id ?? null,
          createdById,
          treatmentName: treatment.name,
          treatmentCategory: treatment.category,
          utrNumber,
          nachStatus: isNachDone ? 'DONE' : null,
          agreementSigned: isAgreementSigned,
          rejectionReason: spec.status === 'REJECTED' ? rand(rejectionReasons) : null,
          remarks: spec.status === 'REJECTED' ? rand(rejectionReasons) : null,
          metadata: {
            panNumber: `${rand(['A','B','C','D','E'])}${rand(['A','B','C','D','E'])}${rand(['A','B','C','D','E'])}${rand(['A','B','C','D','E'])}${rand(['A','B','C','D','E'])}${randInt(1000, 9999)}${rand(['A','B','C','D','E'])}`,
            aadhaarVerified: Math.random() > 0.3,
            panVerified: Math.random() > 0.4,
            employmentType,
            monthlyIncome,
            pincode: `${randInt(110001, 600099)}`,
            city: rand(['Delhi', 'Mumbai', 'Bangalore', 'Hyderabad', 'Chennai', 'Pune', 'Noida']),
            treatmentCategory: treatment.category,
            schemeType: rand(['ZERO_DP', 'ZERO_DP', 'CUSTOM_DP']),
            tenure,
            emi,
            processingFeePct,
            processingFeeAmount,
            downPayment: processingFeePct > 0 ? randAmount(5000, 20000) : 0,
            netLoanAmount: approvedAmount,
            smartScore: { score: randInt(45, 90), grade: rand(['A', 'B', 'C']) },
            allOffers: lender ? [{ lenderName: lender.name, approvedAmount, tenure, emi }] : [],
          },
        },
      })
      i++
      process.stdout.write(`\r  ${i}/${leadSpecs.length} leads created`)
    }
    console.log()
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const [users, regs, lends, clin, leads, schemes, cSchemes] = await Promise.all([
    db.user.count(), db.region.count(), db.lender.count(),
    db.clinic.count(), db.lead.count(),
    db.schemeTemplate.count(), db.clinicScheme.count(),
  ])
  console.log('\n✅  Seed complete!\n')
  console.log('  Users:          ', users)
  console.log('  Regions:        ', regs)
  console.log('  Lenders:        ', lends)
  console.log('  Clinics:        ', clin)
  console.log('  Clinic Schemes: ', cSchemes)
  console.log('  Leads:          ', leads)
  console.log('  Scheme Templates:', schemes)
  console.log('\n  Test credentials (all users): Test@1234')
  console.log('  RM emails: rm.delhi@  rm.mumbai@  rm.bengaluru@trustivasetu.com')
  console.log('  TM emails: tm.delhi1@ tm.mumbai1@ @trustivasetu.com')
}

main().catch(console.error).finally(() => db.$disconnect())
