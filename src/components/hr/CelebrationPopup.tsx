'use client'

import { useState, useEffect } from 'react'
import { useTabSession } from '@/contexts/TabSessionContext'

interface Celebration {
  type: 'birthday' | 'work_anniversary' | 'marriage_anniversary'
  userId: string
  name: string
}

const CONFIG = {
  birthday: { emoji: '🎂', label: 'Happy Birthday', color: 'from-pink-500 to-rose-400', bg: 'bg-pink-50', border: 'border-pink-200' },
  work_anniversary: { emoji: '🎉', label: 'Happy Work Anniversary', color: 'from-brand-600 to-brand-400', bg: 'bg-brand-50', border: 'border-brand-200' },
  marriage_anniversary: { emoji: '💍', label: 'Happy Marriage Anniversary', color: 'from-purple-500 to-violet-400', bg: 'bg-purple-50', border: 'border-purple-200' },
}

export function CelebrationPopup() {
  const { user: session, status } = useTabSession()
  const [celebrations, setCelebrations] = useState<Celebration[]>([])
  const [visible, setVisible] = useState(false)
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    if (status !== 'authenticated') return

    const key = `celebrations_shown_${new Date().toDateString()}`
    if (sessionStorage.getItem(key)) return

    fetch('/api/hr/celebrations')
      .then(r => r.json())
      .then(d => {
        const list: Celebration[] = d.data ?? []
        if (list.length > 0) {
          setCelebrations(list)
          setVisible(true)
          setIdx(0)
          sessionStorage.setItem(key, '1')
        }
      })
      .catch(() => {/* ignore */})
  }, [status])

  if (!visible || celebrations.length === 0) return null

  const current = celebrations[idx]
  const cfg = CONFIG[current.type]
  const isMe = session?.id === current.userId
  const total = celebrations.length

  function next() {
    if (idx < total - 1) setIdx(i => i + 1)
    else setVisible(false)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={next}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-bounce-once"
        onClick={e => e.stopPropagation()}
      >
        {/* Gradient header */}
        <div className={`bg-gradient-to-r ${cfg.color} px-6 py-8 text-center text-white`}>
          <div className="text-6xl mb-3">{cfg.emoji}</div>
          <h2 className="text-xl font-bold">{cfg.label}!</h2>
        </div>

        {/* Body */}
        <div className="px-6 py-5 text-center">
          <p className="text-2xl font-bold text-gray-900">{current.name}</p>
          {isMe && (
            <p className="text-sm text-gray-500 mt-1">That&apos;s you! Wishing you a wonderful day.</p>
          )}
          {!isMe && (
            <p className="text-sm text-gray-500 mt-1">Let&apos;s celebrate together!</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex items-center justify-between">
          {total > 1 && (
            <span className="text-xs text-gray-400">{idx + 1} of {total}</span>
          )}
          <button
            onClick={next}
            className={`ml-auto px-5 py-2 bg-gradient-to-r ${cfg.color} text-white text-sm font-semibold rounded-lg transition hover:opacity-90`}
          >
            {idx < total - 1 ? 'Next →' : '🎊 Celebrate!'}
          </button>
        </div>

        {/* Progress dots */}
        {total > 1 && (
          <div className="pb-4 flex justify-center gap-1.5">
            {celebrations.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full transition ${i === idx ? 'bg-gray-700' : 'bg-gray-300'}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
