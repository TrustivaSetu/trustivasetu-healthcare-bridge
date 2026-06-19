/**
 * Revenue Intelligence — IRR math engine
 *
 * Healthcare "no-cost EMI" / subvention financing model.
 * The patient pays equal EMIs; the hospital pays a subvention + processing fee
 * (the "dealer/merchant discount", DBD) to the lender, on which 18% GST applies.
 * The lender disburses (net loan) and earns back the gross loan in EMIs — the
 * effective yield to the lender is the IRR.
 *
 * All figures are normalised to a NET LOAN of ₹100 so schemes are comparable
 * regardless of ticket size. Annual IRR is reported as an APR (monthly × 12),
 * not a compounded rate — matching how lenders quote these products.
 */

export const GST_RATE = 0.18

export interface Scheme {
  /** Display name, e.g. "Subvention 12% · 9M" */
  name: string
  /** Subvention paid by hospital, % of gross loan */
  subventionPct: number
  /** Processing fee, % of gross loan */
  processingFeePct: number
  /** Total tenure in months */
  tenure: number
  /** Number of EMIs collected in advance (reduces financed balance) */
  advanceEMI: number
}

export interface IRRResult {
  scheme: Scheme
  balance: number
  grossLoan: number
  /** Merchant discount incl. GST, per ₹100 net loan */
  dbdGross: number
  /** Merchant discount excl. GST, per ₹100 net loan */
  dbdNet: number
  netDisbursed: number
  emi: number
  /** Annualised gross IRR (APR %) */
  grossIRR: number
  /** Annualised net IRR after GST drag (APR %) */
  netIRR: number
}

/**
 * Solve for the monthly IRR of a cashflow series via bisection.
 * CF[0] is the (negative) outflow, CF[1..n] the (positive) inflows.
 * Returns the monthly rate, or NaN if no sign change in [0, hi].
 */
export function solveMonthlyIRR(cashflows: number[], hi = 1, iters = 200): number {
  const npv = (r: number) =>
    cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + r, t), 0)

  let lo = 0
  // NPV is monotonically decreasing in r for a standard (one sign change) series.
  let npvLo = npv(lo)
  let npvHi = npv(hi)
  if (npvLo === 0) return lo
  // No bracketed root (e.g. subvention so large the lender profits at r=0 with
  // no positive root, or vice-versa) — caller treats NaN as "n/a".
  if (npvLo * npvHi > 0) return NaN

  let mid = 0
  for (let i = 0; i < iters; i++) {
    mid = (lo + hi) / 2
    const npvMid = npv(mid)
    if (Math.abs(npvMid) < 1e-10) break
    if (npvLo * npvMid < 0) {
      hi = mid
      npvHi = npvMid
    } else {
      lo = mid
      npvLo = npvMid
    }
  }
  return mid
}

/**
 * Compute gross and net annualised IRR for a subvention scheme.
 *
 * Algorithm (per ₹100 GROSS loan; the patient borrows 100 and repays it as
 * equal EMIs over the full tenure):
 *   emi          = 100 / tenure
 *   dbdNet       = 100 × (sub + pf)/100          (merchant discount excl. GST)
 *   dbdGross     = dbdNet × 1.18                 (incl. 18% GST)
 *   netDisbursed = 100 − dbdGross                (cash the hospital receives)
 *   balance      = tenure − advanceEMI           (EMIs financed over time)
 *   CF[0]        = −netDisbursed + advanceEMI×emi (advance EMIs collected upfront
 *                                                  offset the lender's outflow)
 *   CF[1..bal]   = emi                            (gross IRR)
 *   netEmi       = emi − (dbdGross − dbdNet)/balance  (GST drag spread over EMIs)
 *   Annual IRR   = monthlyIRR × 12 × 100          (APR, not compounded)
 */
export function calculateIRR(scheme: Scheme): IRRResult {
  const { subventionPct, processingFeePct, tenure, advanceEMI } = scheme
  const balance = Math.max(tenure - advanceEMI, 1)
  const grossLoan = 100
  const discountPct = (subventionPct + processingFeePct) / 100
  const dbdNet = grossLoan * discountPct
  const dbdGross = dbdNet * (1 + GST_RATE)
  const netDisbursed = grossLoan - dbdGross
  const emi = grossLoan / tenure
  const cf0 = -(netDisbursed - advanceEMI * emi)

  const grossCF = [cf0, ...Array(balance).fill(emi)]
  const grossMonthly = solveMonthlyIRR(grossCF)

  const netEmi = emi - (dbdGross - dbdNet) / balance
  const netCF = [cf0, ...Array(balance).fill(netEmi)]
  const netMonthly = solveMonthlyIRR(netCF)

  return {
    scheme,
    balance,
    grossLoan,
    dbdGross,
    dbdNet,
    netDisbursed,
    emi,
    grossIRR: grossMonthly * 12 * 100,
    netIRR: netMonthly * 12 * 100,
  }
}

export type IRRHealth = 'excellent' | 'good' | 'fair' | 'poor'

/** Categorise a net IRR (APR %) into a health band for benchmarking. */
export function irrHealth(netIRR: number): { band: IRRHealth; label: string; color: string } {
  if (!isFinite(netIRR)) return { band: 'poor', label: 'N/A', color: '#9ca3af' }
  if (netIRR >= 24) return { band: 'excellent', label: 'Excellent', color: '#16a34a' }
  if (netIRR >= 18) return { band: 'good', label: 'Good', color: '#65a30d' }
  if (netIRR >= 12) return { band: 'fair', label: 'Fair', color: '#d97706' }
  return { band: 'poor', label: 'Low', color: '#dc2626' }
}

/** Format a number as Indian-locale INR (₹). */
export function fmtINR(n: number, fractionDigits = 0): string {
  if (!isFinite(n)) return '—'
  return '₹' + n.toLocaleString('en-IN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

/**
 * Standard subvention schemes offered to channel partners.
 * Subvention scales with tenure (longer tenure → more lender risk → higher discount).
 */
export const STANDARD_SCHEMES: Scheme[] = [
  { name: '3 Months · 4%',   subventionPct: 4,  processingFeePct: 1, tenure: 3,  advanceEMI: 0 },
  { name: '6 Months · 7%',   subventionPct: 7,  processingFeePct: 1, tenure: 6,  advanceEMI: 0 },
  { name: '9 Months · 10%',  subventionPct: 10, processingFeePct: 1, tenure: 9,  advanceEMI: 0 },
  { name: '12 Months · 13%', subventionPct: 13, processingFeePct: 1, tenure: 12, advanceEMI: 0 },
  { name: '18 Months · 17%', subventionPct: 17, processingFeePct: 2, tenure: 18, advanceEMI: 0 },
  { name: '24 Months · 21%', subventionPct: 21, processingFeePct: 2, tenure: 24, advanceEMI: 0 },
]
