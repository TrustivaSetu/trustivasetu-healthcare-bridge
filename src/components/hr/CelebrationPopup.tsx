'use client'

import { useState, useEffect } from 'react'
import { useTabSession } from '@/contexts/TabSessionContext'

interface Celebration {
  type: 'birthday' | 'work_anniversary' | 'marriage_anniversary'
  userId: string
  name: string
  isToday: boolean
  yearsCount?: number
}

const CONFIG = {
  birthday: {
    emoji: '🎂',
    label: 'Happy Birthday',
    gradient: 'from-pink-500 to-rose-400',
    msgMe: () => 'Wishing you a fantastic day full of joy! 🎉',
    msgTeam: (name: string) => `It's ${name}'s birthday — let's celebrate! 🎊`,
  },
  work_anniversary: {
    emoji: '🏆',
    label: 'Work Anniversary',
    gradient: 'from-brand-600 to-brand-400',
    msgMe: (yrs?: number) => yrs ? `${ordinal(yrs)} year with Trustiva Setu — thank you for everything! 🚀` : 'Happy Work Anniversary! 🚀',
    msgTeam: (name: string, yrs?: number) => yrs ? `${name} is celebrating ${ordinal(yrs)} year with us!` : `${name} is celebrating a work anniversary!`,
  },
  marriage_anniversary: {
    emoji: '💍',
    label: 'Marriage Anniversary',
    gradient: 'from-purple-500 to-violet-400',
    msgMe: () => 'Wishing you endless love and happiness! 💕',
    msgTeam: (name: string) => `Celebrating love and togetherness with ${name}! 💕`,
  },
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

const CONFETTI_COLORS = ['#f43f5e', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#a3e635', '#fb923c']

function Confetti({ active }: { active: boolean }) {
  if (!active) return null
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-10" aria-hidden>
      {Array.from({ length: 36 }, (_, i) => (
        <div
          key={i}
          className="absolute top-0"
          style={{
            left: `${(i / 36) * 100 + Math.random() * 5}%`,
            width: `${6 + (i % 5)}px`,
            height: `${6 + (i % 4)}px`,
            backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
            borderRadius: i % 3 === 0 ? '50%' : '2px',
            animation: `confettiFall ${2 + (i % 3) * 0.5}s ${(i % 6) * 0.12}s ease-in forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-16px) rotate(0deg);   opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(420px) rotate(540deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}

export function CelebrationPopup() {
  const { user: session, status } = useTabSession()
  const [celebrations, setCelebrations] = useState<Celebration[]>([])
  const [visible, setVisible] = useState(false)
  const [idx, setIdx] = useState(0)
  const [confetti, setConfetti] = useState(false)

  useEffect(() => {
    if (status !== 'authenticated') return
    const key = `celebrations_v2_${new Date().toDateString()}`
    if (sessionStorage.getItem(key)) return

    fetch('/api/hr/celebrations')
      .then(r => r.json())
      .then(d => {
        const list: Celebration[] = (d.data ?? []).filter((c: Celebration) => c.isToday)
        if (list.length === 0) return
        setCelebrations(list)
        setIdx(0)
        setVisible(true)
        setConfetti(true)
        sessionStorage.setItem(key, '1')
        setTimeout(() => setConfetti(false), 3500)
      })
      .catch(() => {})
  }, [status])

  if (!visible || celebrations.length === 0) return null

  const c = celebrations[idx]
  const cfg = CONFIG[c.type]
  const isMe = session?.id === c.userId
  const total = celebrations.length

  const message = c.type === 'work_anniversary'
    ? (isMe ? cfg.msgMe(c.yearsCount) : cfg.msgTeam(c.name, c.yearsCount))
    : (isMe ? cfg.msgMe() : cfg.msgTeam(c.name))

  function advance() {
    if (idx < total - 1) {
      setIdx(i => i + 1)
      setConfetti(true)
      setTimeout(() => setConfetti(false), 3000)
    } else {
      setVisible(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={advance}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
        style={{ animation: 'celebPop 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
        onClick={e => e.stopPropagation()}
      >
        <Confetti active={confetti} />

        {/* Gradient header */}
        <div className={`relative bg-gradient-to-br ${cfg.gradient} px-6 py-8 text-center text-white overflow-hidden`}>
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(circle, white 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }} />
          <div className="relative text-6xl mb-2 select-none">{cfg.emoji}</div>
          <h2 className="relative text-xl font-bold tracking-tight">{cfg.label}!</h2>
          {c.yearsCount && (
            <p className="relative mt-1 text-sm font-semibold opacity-90">
              {ordinal(c.yearsCount)} {c.type === 'work_anniversary' ? 'Year with Us' : 'Anniversary'}
            </p>
          )}
        </div>

        {/* Body */}
        <div className="relative px-6 py-5 text-center">
          <p className="text-2xl font-bold text-gray-900 leading-tight">{c.name}</p>
          {isMe && (
            <span className="mt-1.5 inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2.5 py-0.5 rounded-full font-semibold">
              ✨ That&apos;s you!
            </span>
          )}
          <p className="mt-2 text-sm text-gray-500 leading-relaxed">{message}</p>
        </div>

        {/* Footer */}
        <div className="relative px-6 pb-5 flex items-center justify-between">
          {total > 1 && (
            <span className="text-xs text-gray-400 tabular-nums">{idx + 1} / {total}</span>
          )}
          <button
            onClick={advance}
            className={`ml-auto px-5 py-2 bg-gradient-to-r ${cfg.gradient} text-white text-sm font-semibold rounded-lg hover:opacity-90 active:scale-95 transition-transform`}
          >
            {idx < total - 1 ? 'Next →' : '🎊 Celebrate!'}
          </button>
        </div>

        {total > 1 && (
          <div className="relative pb-4 flex justify-center gap-1.5">
            {celebrations.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={e => { e.stopPropagation(); setIdx(i) }}
                className={`w-2 h-2 rounded-full transition-colors ${i === idx ? 'bg-gray-700' : 'bg-gray-300 hover:bg-gray-400'}`}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes celebPop {
          0%   { transform: scale(0.7) translateY(20px); opacity: 0; }
          100% { transform: scale(1)   translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  )
}
