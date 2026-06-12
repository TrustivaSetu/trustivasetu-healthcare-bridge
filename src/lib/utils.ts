import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, subMonths } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatLakhs(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `₹${value.toFixed(2)}L`
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return format(new Date(date), 'dd MMM yyyy')
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  return format(new Date(date), 'dd MMM yyyy, HH:mm')
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function getGrowthColor(value: number): string {
  if (value > 0) return 'text-green-600'
  if (value < 0) return 'text-red-600'
  return 'text-gray-500'
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    DOCS_PENDING: 'bg-orange-100 text-orange-800',
    KYC_PENDING: 'bg-purple-100 text-purple-800',
    KYC_APPROVED: 'bg-violet-100 text-violet-800',
    MARKUP_PENDING: 'bg-sky-100 text-sky-800',
    PROCESSING: 'bg-cyan-100 text-cyan-800',
    APPROVED: 'bg-blue-100 text-blue-800',
    DISBURSED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    CANCELLED: 'bg-gray-100 text-gray-800',
  }
  return map[status] ?? 'bg-gray-100 text-gray-800'
}

export function getTaskStatusColor(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    IN_PROGRESS: 'bg-blue-100 text-blue-700',
    DONE: 'bg-green-100 text-green-700',
    PROCESSED: 'bg-gray-100 text-gray-700',
  }
  return map[status] ?? 'bg-gray-100 text-gray-700'
}

export function getRoleColor(role: string): string {
  const map: Record<string, string> = {
    SUPER_ADMIN: 'bg-purple-100 text-purple-800',
    ADMIN: 'bg-blue-100 text-blue-800',
    REGIONAL_MANAGER: 'bg-teal-100 text-teal-800',
    TEAM_MEMBER: 'bg-gray-100 text-gray-800',
  }
  return map[role] ?? 'bg-gray-100 text-gray-800'
}

export function getRoleLabel(role: string): string {
  const map: Record<string, string> = {
    SUPER_ADMIN: 'Super Admin',
    ADMIN: 'Admin',
    REGIONAL_MANAGER: 'Regional Manager',
    TEAM_MEMBER: 'Team Member',
  }
  return map[role] ?? role
}

export function generateMonthOptions(count = 12): Array<{ value: string; label: string }> {
  return Array.from({ length: count }, (_, i) => {
    const date = subMonths(new Date(), i)
    return { value: format(date, 'yyyy-MM'), label: format(date, 'MMMM yyyy') }
  })
}

