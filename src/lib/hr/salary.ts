export const CONVEYANCE = 1600
export const MEDICAL_ALLOWANCE = 1250
export const PROFESSIONAL_TAX = 200

export interface SalaryComponents {
  grossSalary: number
  basic: number
  hra: number
  specialAllowance: number
  conveyance: number
  medicalAllowance: number
  lta: number
  bonus: number
  employeePF: number
  employerPF: number
  gratuity: number
  professionalTax: number
  tds: number
  netSalary: number
  totalCTC: number
}

export function calculateSalary(grossSalary: number, tds = 0): SalaryComponents {
  const basic = grossSalary * 0.4
  const hra = grossSalary * 0.2
  const lta = basic * 0.0833
  const bonus = basic * 0.0833
  const specialAllowance = Math.max(0, grossSalary - basic - hra - CONVEYANCE - MEDICAL_ALLOWANCE - lta - bonus)
  const employeePF = basic * 0.12
  const employerPF = basic * 0.12
  const gratuity = basic * 0.0481
  const netSalary = grossSalary - employeePF - PROFESSIONAL_TAX - tds
  const totalCTC = grossSalary + employerPF + gratuity

  return {
    grossSalary,
    basic,
    hra,
    specialAllowance,
    conveyance: CONVEYANCE,
    medicalAllowance: MEDICAL_ALLOWANCE,
    lta,
    bonus,
    employeePF,
    employerPF,
    gratuity,
    professionalTax: PROFESSIONAL_TAX,
    tds,
    netSalary,
    totalCTC,
  }
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

// Working days in a month = weekdays - holidays that fall on weekdays
export function getWorkingDaysInMonth(year: number, month: number, holidayDates: Date[]): number {
  const holidaySet = new Set(holidayDates.map(d => d.toISOString().split('T')[0]))
  let count = 0
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d)
    const dow = date.getDay()
    const iso = date.toISOString().split('T')[0]
    if (dow !== 0 && dow !== 6 && !holidaySet.has(iso)) count++
  }
  return count
}

export function calculateMonthlyPayable(
  netSalary: number,
  workingDays: number,
  attendances: Array<{ attendanceType: string; leaveType: string | null; workingType: string }>
): number {
  if (workingDays === 0) return 0
  let paidDays = 0
  for (const a of attendances) {
    const half = a.workingType === 'HALF_DAY' ? 0.5 : 1
    if (a.attendanceType === 'PRESENT' || a.attendanceType === 'OUTSTATION') {
      paidDays += half
    } else if (a.attendanceType === 'LEAVE') {
      // PL, CL, MEDICAL = paid; UNPLANNED = unpaid
      if (a.leaveType === 'PL' || a.leaveType === 'CL' || a.leaveType === 'MEDICAL') {
        paidDays += half
      }
    }
  }
  return (netSalary / workingDays) * paidDays
}
