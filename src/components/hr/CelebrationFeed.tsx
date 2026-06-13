'use client'

import { useState, useEffect } from 'react'
import { useTabSession } from '@/contexts/TabSessionContext'

interface Celebration {
  type: 'birthday' | 'work_anniversary' | 'marriage_anniversary'
  userId: string
  name: string
  daysFromNow: number
  isToday: boolean
  yearsCount?: number
}

const TYPE = {
  birthday:             { emoji: '🎂', label: 'Birthday',         pill: 'bg-pink-100 text-pink-700'   },
  work_anniversary:     { emoji: '🏆', label: 'Work Anniv.',      pill: 'bg-blue-100 text-blue-700'    },
  marriage_anniversary: { emoji: '💍', label: 'Marriage Anniv.',  pill: 'bg-purple-100 text-purple-700' },
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function CelebrationFeed() {
  const { status } = useTabSession()
  const [items, setItems] = useState<Celebration[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status !== 'authenticated') return
    fetch('/api/hr/celebrations?upcoming=30')
      .then(r => r.json())
      .then(d => { setItems(d.data ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [status])

  const today  = items.filter(c => c.isToday)
  const coming = items.filter(c => !c.isToday).slice(0, 7)

  if (loading) return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
      <div className="h-3.5 w-28 bg-gray-100 rounded animate-pulse" />
      {[1, 2, 3].map(i => <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" />)}
    </div>
  )

  if (today.length === 0 && coming.length === 0) return null

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
        <span className="text-base">🎉</span>
        <span className="text-sm font-semibold text-gray-800">Team Celebrations</span>
        {today.length > 0 && (
          <span className="ml-auto text-xs font-semibold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
            {today.length} today!
          </span>
        )}
      </div>

      {/* Today */}
      {today.length > 0 && (
        <div className="px-4 py-3 bg-gradient-to-r from-yellow-50 to-orange-50 border-b border-yellow-100">
          <p className="text-[11px] font-bold text-yellow-700 uppercase tracking-wide mb-2">🌟 Today</p>
          <div className="space-y-2">
            {today.map((c, i) => {
              const t = TYPE[c.type]
              return (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="text-xl">{t.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate leading-tight">{c.name}</p>
                    <p className="text-xs text-gray-500">
                      {t.label}{c.yearsCount ? ` · ${ordinal(c.yearsCount)} year` : ''}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${t.pill}`}>
                    Today
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {coming.length > 0 && (
        <div className="px-4 py-3 space-y-2">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Upcoming</p>
          {coming.map((c, i) => {
            const t = TYPE[c.type]
            return (
              <div key={i} className="flex items-center gap-2.5">
                <span className="text-base">{t.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-900 truncate">{c.name}</p>
                  <p className="text-xs text-gray-400">{t.label}</p>
                </div>
                <span className="flex-shrink-0 text-xs text-gray-400 font-medium">
                  {c.daysFromNow === 1 ? 'Tomorrow' : `${c.daysFromNow}d`}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
