'use client'

interface Props {
  score: number
  grade: 'A' | 'B' | 'C' | 'D'
  signals: string[]
  totalLenders: number
  eligibleLenders: number
}

export function SmartScoreMeter({ score, grade, signals, totalLenders, eligibleLenders }: Props) {
  const color = grade === 'A' ? '#22c55e' : grade === 'B' ? '#3b82f6' : grade === 'C' ? '#f59e0b' : '#ef4444'
  const label = grade === 'A' ? 'Excellent' : grade === 'B' ? 'Good' : grade === 'C' ? 'Fair' : 'Low'

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-4">
        <div className="relative w-20 h-20 flex-shrink-0">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="12" />
            <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="12"
              strokeDasharray={`${score * 2.51} 251`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold" style={{ color }}>{score}</span>
            <span className="text-xs font-bold" style={{ color }}>{grade}</span>
          </div>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-800">Smart Score: {label}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {eligibleLenders} of {totalLenders} lenders eligible
          </p>
          <p className="text-xs text-green-600 mt-1 font-medium">No CIBIL hit — score safe ✅</p>
        </div>
      </div>

      <div className="space-y-1">
        {signals.slice(0, 5).map((s, i) => (
          <p key={i} className="text-xs text-gray-600 flex items-center gap-1.5">
            <span>
              {s.includes('✅') ? '🟢' : s.includes('⚠️') ? '🟡' : s.includes('❌') ? '🔴' : '🔵'}
            </span>
            {s.replace('✅', '').replace('⚠️', '').replace('❌', '').trim()}
          </p>
        ))}
      </div>
    </div>
  )
}
