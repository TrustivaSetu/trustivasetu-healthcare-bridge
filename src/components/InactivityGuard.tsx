'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useTabSession, tabSignOut } from '@/contexts/TabSessionContext'

const TIMEOUT_MS = 5 * 60 * 1000  // 5 minutes of idle → auto logout
const WARNING_MS = 60 * 1000      // show warning when 60 seconds remain

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'click'] as const

export function InactivityGuard() {
  const { status } = useTabSession()
  const lastActivityRef = useRef(Date.now())
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)

  const stayLoggedIn = useCallback(() => {
    lastActivityRef.current = Date.now()
    setSecondsLeft(null)
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return

    const updateActivity = () => {
      lastActivityRef.current = Date.now()
    }

    ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, updateActivity, { passive: true }))

    const tick = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current
      const remainingMs = TIMEOUT_MS - idleMs

      if (remainingMs <= 0) {
        clearInterval(tick)
        tabSignOut('/lms/login?expired=true')
      } else if (remainingMs <= WARNING_MS) {
        setSecondsLeft(Math.ceil(remainingMs / 1000))
      } else {
        setSecondsLeft(null)
      }
    }, 1000)

    return () => {
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, updateActivity))
      clearInterval(tick)
    }
  }, [status])

  if (status !== 'authenticated' || secondsLeft === null) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.07 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Session Expiring Soon</h2>
        <p className="text-sm text-gray-600 mb-6">
          You will be logged out in{' '}
          <span className="font-bold text-amber-600">
            {secondsLeft} second{secondsLeft !== 1 ? 's' : ''}
          </span>{' '}
          due to inactivity.
        </p>
        <button
          onClick={stayLoggedIn}
          className="w-full bg-trustiva-lime hover:opacity-90 text-trustiva-navy font-bold py-3 px-4 rounded-xl transition text-sm"
        >
          Stay Logged In
        </button>
      </div>
    </div>
  )
}
