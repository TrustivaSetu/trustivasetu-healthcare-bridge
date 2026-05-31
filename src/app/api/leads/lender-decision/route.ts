import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'

interface LenderInput {
  id: string
  name: string
  code: string
}

interface LenderDecision {
  lenderId: string
  lenderName: string
  lenderCode: string
  approved: boolean
  approvedAmount: number
  interestRate: number
  tenure: number
  emi: number
  message: string
}

function calculateEMI(principal: number, annualRate: number, tenureMonths: number): number {
  const r = annualRate / 100 / 12
  if (r === 0) return Math.round(principal / tenureMonths)
  const emi = principal * r * Math.pow(1 + r, tenureMonths) / (Math.pow(1 + r, tenureMonths) - 1)
  return Math.round(emi)
}

function mockLenderDecision(
  lender: LenderInput,
  monthlyIncome: number,
  loanAmount: number,
  employmentType: string,
  pincode: string
): LenderDecision {
  // Basic eligibility: loan amount <= 75% of monthly income * 12 (annual)
  const maxEligible = monthlyIncome * 12 * 0.75
  const foir = 0.5 // Fixed Obligation to Income Ratio
  const maxEMI = monthlyIncome * foir

  // Different lenders have different criteria (mock)
  const lenderProfiles: Record<string, { maxAmount: number; rate: number; tenure: number; minIncome: number }> = {
    'HDFC': { maxAmount: 500000, rate: 14, tenure: 36, minIncome: 25000 },
    'BAJAJ': { maxAmount: 300000, rate: 16, tenure: 24, minIncome: 15000 },
    'ICICI': { maxAmount: 400000, rate: 15, tenure: 30, minIncome: 20000 },
    'AXIS': { maxAmount: 350000, rate: 15.5, tenure: 30, minIncome: 18000 },
    'SBI': { maxAmount: 200000, rate: 13, tenure: 24, minIncome: 20000 },
    'KOTAK': { maxAmount: 450000, rate: 14.5, tenure: 36, minIncome: 22000 },
  }

  const profile = lenderProfiles[lender.code] ?? { maxAmount: 250000, rate: 16, tenure: 24, minIncome: 15000 }

  // Check eligibility
  if (monthlyIncome < profile.minIncome) {
    return {
      lenderId: lender.id, lenderName: lender.name, lenderCode: lender.code,
      approved: false, approvedAmount: 0, interestRate: 0, tenure: 0, emi: 0,
      message: `Minimum income Rs ${profile.minIncome.toLocaleString('en-IN')}/month required`,
    }
  }

  // Calculate approved amount
  const eligibleByIncome = Math.min(maxEligible, profile.maxAmount)
  const approvedAmount = Math.min(loanAmount, eligibleByIncome)
  const emi = calculateEMI(approvedAmount, profile.rate, profile.tenure)

  if (emi > maxEMI) {
    // Reduce amount to fit EMI
    const reducedAmount = Math.floor((maxEMI * (Math.pow(1 + profile.rate/100/12, profile.tenure) - 1)) /
      (profile.rate/100/12 * Math.pow(1 + profile.rate/100/12, profile.tenure)))
    if (reducedAmount < 10000) {
      return {
        lenderId: lender.id, lenderName: lender.name, lenderCode: lender.code,
        approved: false, approvedAmount: 0, interestRate: 0, tenure: 0, emi: 0,
        message: 'Income insufficient for requested loan amount',
      }
    }
    const reducedEmi = calculateEMI(reducedAmount, profile.rate, profile.tenure)
    return {
      lenderId: lender.id, lenderName: lender.name, lenderCode: lender.code,
      approved: true, approvedAmount: reducedAmount,
      interestRate: profile.rate, tenure: profile.tenure, emi: reducedEmi,
      message: `Approved for Rs ${reducedAmount.toLocaleString('en-IN')} (reduced based on FOIR)`,
    }
  }

  return {
    lenderId: lender.id, lenderName: lender.name, lenderCode: lender.code,
    approved: true, approvedAmount,
    interestRate: profile.rate, tenure: profile.tenure, emi,
    message: `Pre-approved! EMI: Rs ${emi.toLocaleString('en-IN')}/month`,
  }
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    monthlyIncome, loanAmount, employmentType, pincode, lenders,
    applicantName, panNumber, clinicId,
  } = body

  if (!monthlyIncome || !loanAmount || !lenders?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Get active lenders with API config
  const activeLenders = await db.lender.findMany({
    where: { isActive: true },
  })

  const decisions: LenderDecision[] = []

  for (const lender of activeLenders) {
    const meta = lender.metadata as Record<string, unknown> | null
    const hasApi = meta?.apiUrl && meta?.apiKey

    if (hasApi) {
      // TODO: Real lender API call
      // const decision = await callLenderApi(lender, body)
      // decisions.push(decision)

      // Mock for now even if API configured
      const mockDecision = mockLenderDecision(
        { id: lender.id, name: lender.name, code: lender.code },
        parseFloat(String(monthlyIncome)),
        parseFloat(String(loanAmount)),
        employmentType,
        pincode
      )
      decisions.push(mockDecision)
    } else {
      // Mock decision
      const mockDecision = mockLenderDecision(
        { id: lender.id, name: lender.name, code: lender.code },
        parseFloat(String(monthlyIncome)),
        parseFloat(String(loanAmount)),
        employmentType,
        pincode
      )
      decisions.push(mockDecision)
    }
  }

  // Sort: approved first, then by amount desc
  decisions.sort((a, b) => {
    if (a.approved && !b.approved) return -1
    if (!a.approved && b.approved) return 1
    return b.approvedAmount - a.approvedAmount
  })

  return NextResponse.json({ decisions, total: decisions.length })
}