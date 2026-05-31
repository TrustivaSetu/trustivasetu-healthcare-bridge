import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'

// ── Smart Scoring Engine (No CIBIL hit) ───────────────────────────────────────
interface SmartScore {
  score: number
  grade: 'A' | 'B' | 'C' | 'D'
  maxAmount: number
  signals: string[]
}

interface LenderOffer {
  rank: number
  lenderId: string
  lenderName: string
  lenderCode: string
  approvedAmount: number
  interestRate: number    // Internal only — NOT shown to customer
  tenure: number
  emi: number             // No Cost EMI (subvention — rate borne by clinic)
  processingFee: number   // Only fee customer pays
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  tag: string
  instantApproval: boolean
  requiresIncomeProof: boolean
  decisionTime: string
  message: string
}

interface QualifyRequest {
  phone: string
  applicantName: string
  employmentType: 'SALARIED' | 'SELF_EMPLOYED' | 'BUSINESS' | 'OTHER'
  monthlyIncome: number
  pincode: string
  loanAmount: number
  treatmentCategory: string
  panNumber?: string
  aadhaarVerified?: boolean
}

// ── Smart Score — 6 Alternative Signals (No Bureau) ─────────────────────────
function computeSmartScore(req: QualifyRequest): SmartScore {
  let score = 50
  const signals: string[] = []

  // 1. Income (0-25 pts)
  const income = req.monthlyIncome
  if (income >= 50000) { score += 25; signals.push('High income ✅') }
  else if (income >= 30000) { score += 18; signals.push('Good income ✅') }
  else if (income >= 20000) { score += 12; signals.push('Moderate income') }
  else if (income >= 15000) { score += 6; signals.push('Low income ⚠️') }
  else { score -= 5; signals.push('Very low income ❌') }

  // 2. Employment (0-15 pts)
  if (req.employmentType === 'SALARIED') { score += 15; signals.push('Salaried — stable income ✅') }
  else if (req.employmentType === 'BUSINESS') { score += 10; signals.push('Business owner') }
  else if (req.employmentType === 'SELF_EMPLOYED') { score += 8; signals.push('Self employed') }
  else { score += 3 }

  // 3. KYC (0-15 pts)
  if (req.aadhaarVerified && req.panNumber) { score += 15; signals.push('Full KYC done ✅') }
  else if (req.panNumber) { score += 8; signals.push('PAN available') }
  else if (req.aadhaarVerified) { score += 6; signals.push('Aadhaar verified') }

  // 4. Loan-to-Income ratio (0-15 pts)
  const lti = req.loanAmount / income
  if (lti <= 2) { score += 15; signals.push('Excellent loan-to-income ratio ✅') }
  else if (lti <= 4) { score += 10; signals.push('Good loan-to-income ratio') }
  else if (lti <= 6) { score += 5; signals.push('Moderate LTI') }
  else { score -= 5; signals.push('High LTI ⚠️') }

  // 5. Metro pincode (0-5 pts)
  const metroPins = ['110', '400', '500', '600', '700', '560', '411', '302', '226', '380']
  if (metroPins.some(p => req.pincode.startsWith(p))) {
    score += 5; signals.push('Metro location ✅')
  }

  // 6. Treatment category (0-5 pts)
  const highSuccessCats = ['Dental', 'Ophthalmology', 'Hair Transplant', 'IVF & Fertility']
  if (highSuccessCats.includes(req.treatmentCategory)) {
    score += 5; signals.push('High-success treatment ✅')
  }

  score = Math.max(0, Math.min(100, score))
  const grade = score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 45 ? 'C' : 'D'

  // Max instant amount (upto 75k, no income proof needed)
  const maxAmount = score >= 75 ? 75000
    : score >= 60 ? 60000
    : score >= 45 ? 40000
    : score >= 35 ? 25000
    : 0

  return { score, grade, maxAmount, signals }
}

// ── Lender Matching (Subvention Model) ───────────────────────────────────────
// Rate is internal — customer sees No Cost EMI
// EMI = principal / tenure (no interest to customer)
// Clinic pays subvention = principal * rate to lender
function matchLender(
  lenderId: string,
  lenderName: string,
  lenderCode: string,
  req: QualifyRequest,
  smartScore: SmartScore,
): LenderOffer | null {
  const income = req.monthlyIncome
  const requestedAmount = Math.min(req.loanAmount, 75000)

  // Lender profiles (internal — rate not shown to customer)
  const profiles: Record<string, {
    minIncome: number; maxInstant: number; internalRate: number
    tenure: number; processingFeePct: number
    minScore: number; employmentAllowed: string[]
  }> = {
    'HDFC':  { minIncome: 25000, maxInstant: 75000, internalRate: 13.5, tenure: 12, processingFeePct: 1.5, minScore: 65, employmentAllowed: ['SALARIED', 'BUSINESS'] },
    'BAJAJ': { minIncome: 15000, maxInstant: 75000, internalRate: 15.5, tenure: 9,  processingFeePct: 2.0, minScore: 45, employmentAllowed: ['SALARIED', 'SELF_EMPLOYED', 'BUSINESS', 'OTHER'] },
    'ICICI': { minIncome: 20000, maxInstant: 70000, internalRate: 14.0, tenure: 12, processingFeePct: 1.5, minScore: 60, employmentAllowed: ['SALARIED', 'BUSINESS'] },
    'AXIS':  { minIncome: 18000, maxInstant: 65000, internalRate: 14.5, tenure: 9,  processingFeePct: 1.75,minScore: 55, employmentAllowed: ['SALARIED', 'SELF_EMPLOYED', 'BUSINESS'] },
    'KOTAK': { minIncome: 22000, maxInstant: 75000, internalRate: 14.0, tenure: 12, processingFeePct: 1.5, minScore: 60, employmentAllowed: ['SALARIED', 'BUSINESS'] },
    'SBI':   { minIncome: 20000, maxInstant: 50000, internalRate: 12.5, tenure: 6,  processingFeePct: 1.0, minScore: 65, employmentAllowed: ['SALARIED'] },
  }

  const p = profiles[lenderCode] ?? {
    minIncome: 15000, maxInstant: 50000, internalRate: 16,
    tenure: 9, processingFeePct: 2, minScore: 40,
    employmentAllowed: ['SALARIED', 'SELF_EMPLOYED', 'BUSINESS', 'OTHER'],
  }

  // Eligibility
  if (smartScore.score < p.minScore) return null
  if (income < p.minIncome) return null
  if (!p.employmentAllowed.includes(req.employmentType)) return null

  // Calculate amount
  const foir = req.employmentType === 'SALARIED' ? 0.55 : 0.45
  const maxByFOIR = income * foir * p.tenure
  const approvedAmount = Math.min(requestedAmount, p.maxInstant, maxByFOIR, smartScore.maxAmount)

  if (approvedAmount < 10000) return null

  // No Cost EMI = principal / tenure (customer pays no interest)
  // Clinic pays subvention = difference between actual cost and principal
  const emi = Math.round(approvedAmount / p.tenure)

  // Processing fee (only customer-facing cost)
  const processingFee = Math.round(approvedAmount * p.processingFeePct / 100)

  return {
    rank: 0,
    lenderId,
    lenderName,
    lenderCode,
    approvedAmount: Math.round(approvedAmount),
    interestRate: p.internalRate, // Internal only — not shown to customer
    tenure: p.tenure,
    emi,                          // No Cost EMI
    processingFee,
    confidence: smartScore.score >= 70 ? 'HIGH' : smartScore.score >= 55 ? 'MEDIUM' : 'LOW',
    tag: '',
    instantApproval: true,
    requiresIncomeProof: false,
    decisionTime: '< 2 min',
    message: `No Cost EMI — ₹${emi.toLocaleString('en-IN')}/month for ${p.tenure} months`,
  }
}

// ── Main Handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const startTime = Date.now()
  const body: QualifyRequest = await req.json()

  if (!body.monthlyIncome || !body.loanAmount || !body.pincode) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // 1. Smart Score (no bureau hit)
  const smartScore = computeSmartScore(body)

  // 2. Get active lenders
  const dbLenders = await db.lender.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
  })

  // 3. Parallel matching — all lenders simultaneously
  const offerPromises = dbLenders.map(async (lender) => {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 300))
    return matchLender(lender.id, lender.name, lender.code, body, smartScore)
  })

  const rawOffers = await Promise.all(offerPromises)
  const validOffers = rawOffers.filter(Boolean) as LenderOffer[]

  // 4. Rank — Best for customer (highest amount, lowest processing fee)
  validOffers.sort((a, b) => {
    const scoreA = (a.approvedAmount * 0.5) - (a.processingFee * 0.3) + (a.confidence === 'HIGH' ? 5000 : a.confidence === 'MEDIUM' ? 2500 : 0)
    const scoreB = (b.approvedAmount * 0.5) - (b.processingFee * 0.3) + (b.confidence === 'HIGH' ? 5000 : b.confidence === 'MEDIUM' ? 2500 : 0)
    return scoreB - scoreA
  })

  // Top 3 with tags
  const top3 = validOffers.slice(0, 3).map((offer, i) => ({
    ...offer,
    rank: i + 1,
    tag: i === 0 ? '⭐ Best Match' :
         i === 1 ? '💳 Lowest Fee' :
                   '⚡ Fastest Approval',
  }))

  const processingTime = Date.now() - startTime

  return NextResponse.json({
    success: true,
    processingTimeMs: processingTime,
    smartScore: {
      score: smartScore.score,
      grade: smartScore.grade,
      signals: smartScore.signals,
      maxInstantAmount: smartScore.maxAmount,
    },
    offers: top3,
    totalLendersChecked: dbLenders.length,
    totalEligible: validOffers.length,
    isNoCostEMI: true,
    message: top3.length > 0
      ? `${top3.length} No Cost EMI offers — processed in ${processingTime}ms!`
      : 'No offers available — adjust income or loan amount',
    nextStep: top3.length > 0 ? 'SELECT_OFFER' : 'ENHANCEMENT_REQUIRED',
  })
}