import { cn, formatPercent, getGrowthColor } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: string | number
  subValue?: string
  growth?: number
  icon: React.ReactNode
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'teal' | 'red'
  loading?: boolean
}

const colorMap = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  purple: 'bg-purple-50 text-purple-600',
  orange: 'bg-orange-50 text-orange-600',
  teal: 'bg-teal-50 text-teal-600',
  red: 'bg-red-50 text-red-600',
}

export function MetricCard({ title, value, subValue, growth, icon, color = 'blue', loading }: MetricCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-2/3 mb-4" />
        <div className="h-8 bg-gray-200 rounded w-1/2" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subValue && <p className="text-sm text-gray-500 mt-0.5">{subValue}</p>}
          {growth !== undefined && (
            <p className={cn('text-xs font-medium mt-1', getGrowthColor(growth))}>
              {formatPercent(growth)} vs last month
            </p>
          )}
        </div>
        <div className={cn('p-2.5 rounded-lg', colorMap[color])}>{icon}</div>
      </div>
    </div>
  )
}
