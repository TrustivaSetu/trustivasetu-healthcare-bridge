import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'

interface EnhancedDecision {
  status: 'INCOME_NOT_VERIFIED' | 'ENHANCEMENT_NOT_POSSIBLE' | 'ENHANCEMENT_DONE'
  message: string
  approvedAmount?: number
  lenderName?: string
  details?: string
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    monthlyIncome,
    loanAmount,
    selectedLender,
    bankStatementUrl,
    aaConsentGiven,
  } = await req.json()

  // Check if income was verified
  const incomeVerified = aaConsentGiven || !!bankStatementUrl

  if (!incomeVerified) {
    const decision: EnhancedDecision = {
      status: 'INCOME_NOT_VERIFIED',
      message: 'Income could not be verified — bank statement or AA consent required',
      details: 'Please provide bank statement or account aggregator consent to proceed with enhancement',
    }
    return NextResponse.json({ decision })
  }

  // Mock income analysis
  const verifiedMonthlyIncome = parseFloat(String(monthlyIncome))
  const requestedAmount = parseFloat(String(loanAmount))
  const currentApproved = selectedLender?.approvedAmount ?? 0

  // Enhanced eligibility: 40% of annual income
  const enhancedMax = verifiedMonthlyIncome * 12 * 0.40
  const enhancedAmount = Math.min(requestedAmount, enhancedMax)

  if (enhancedAmount <= currentApproved * 1.05) {
    // Less than 5% improvement — not possible
    const decision: EnhancedDecision = {
      status: 'ENHANCEMENT_NOT_POSSIBLE',
      message: 'Income verified but enhancement is not possible',
      details: `Current approved: Rs ${currentApproved.toLocaleString('en-IN')}. Cannot increase further based on income.`,
    }
    return NextResponse.json({ decision })
  }

  // Enhancement approved
  const decision: EnhancedDecision = {
    status: 'ENHANCEMENT_DONE',
    message: `Enhancement approved! Higher amount approved after income verification.`,
    approvedAmount: Math.round(enhancedAmount),
    lenderName: selectedLender?.lenderName ?? 'Selected Lender',
    details: `Income verified: Rs ${verifiedMonthlyIncome.toLocaleString('en-IN')}/month. Enhanced limit: Rs ${Math.round(enhancedAmount).toLocaleString('en-IN')}`,
  }
  return NextResponse.json({ decision })
}