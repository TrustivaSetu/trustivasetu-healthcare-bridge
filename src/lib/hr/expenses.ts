// Travel rate per km by designation
const FIELD_DESIGNATIONS = ['RM - Sales', 'RM - BD']

export function getTravelRatePerKm(designation: string | null): number {
  return FIELD_DESIGNATIONS.includes(designation ?? '') ? 3 : 5
}

// Monthly travel expense cap by designation level
export function getMonthlyTravelCap(designation: string | null): number {
  if (!designation) return 5000
  if (FIELD_DESIGNATIONS.includes(designation)) return 5000
  // Manager level
  if (
    designation.startsWith('District Manager') ||
    designation.startsWith('State Head') ||
    designation.startsWith('Regional Head') ||
    designation === 'Debt Manager'
  ) return 10000
  // Admin / Head / Founder level
  return 20000
}

export const EXPENSE_CATEGORIES = [
  { value: 'TRAVEL_KM', label: 'Travel (per km)', hasKm: true, hasBill: false, hasClient: false },
  { value: 'TAXI_LOCAL', label: 'Taxi / Auto / Cab', hasKm: false, hasBill: true, hasClient: false },
  { value: 'MEALS', label: 'Meals / Food', hasKm: false, hasBill: true, hasClient: false },
  { value: 'MOBILE', label: 'Mobile / Internet Bill', hasKm: false, hasBill: true, hasClient: false },
  { value: 'MEDICAL', label: 'Medical Expense', hasKm: false, hasBill: true, hasClient: false },
  { value: 'CLIENT_ENTERTAINMENT', label: 'Client Entertainment', hasKm: false, hasBill: true, hasClient: true },
  { value: 'OFFICE_SUPPLIES', label: 'Office Supplies', hasKm: false, hasBill: true, hasClient: false },
  { value: 'OTHER', label: 'Other', hasKm: false, hasBill: true, hasClient: false },
] as const

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]['value']

export function getCategoryLabel(cat: string): string {
  return EXPENSE_CATEGORIES.find(c => c.value === cat)?.label ?? cat
}
