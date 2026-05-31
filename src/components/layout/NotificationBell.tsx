'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { formatDateTime, cn } from '@/lib/utils'

interface Notification {
  id: string
  title: string
  message: string
  type: string
  isRead: boolean
  link: string | null
  createdAt: string
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)

  const unread = items.filter(n => !n.isRead).length

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const json = await res.json()
      setItems(json.data ?? [])
    } catch {
      // silently ignore network errors
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 60000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  async function markRead(id: string) {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setItems(prev => prev.map(n => (n.id === id ? { ...n, isRead: true } : n)))
  }

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'all' }),
    })
    setItems(prev => prev.map(n => ({ ...n, isRead: true })))
  }

  const typeColor: Record<string, string> = {
    INFO: 'bg-blue-100 text-blue-700',
    SUCCESS: 'bg-green-100 text-green-700',
    WARNING: 'bg-amber-100 text-amber-700',
    ERROR: 'bg-red-100 text-red-700',
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); if (!open) fetchNotifications() }}
        className="relative p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <button type="button" className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-label="Close" />
          <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-xl border border-gray-100 z-50 max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
              {unread > 0 && (
                <button type="button" onClick={markAllRead} className="text-xs text-brand-600 hover:text-brand-800 font-medium">
                  Mark all read
                </button>
              )}
            </div>
            <div className="overflow-y-auto flex-1">
              {loading && items.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Loading...</p>
              ) : items.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">No notifications</p>
              ) : (
                items.map(n => (
                  <div
                    key={n.id}
                    className={cn('px-4 py-3 border-b border-gray-50 hover:bg-gray-50', !n.isRead && 'bg-brand-50/50')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', typeColor[n.type] ?? typeColor.INFO)}>
                            {n.type}
                          </span>
                          {!n.isRead && <span className="w-1.5 h-1.5 bg-brand-500 rounded-full" />}
                        </div>
                        <p className="text-sm font-medium text-gray-800">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-gray-400 mt-1">{formatDateTime(n.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {n.link && (
                        <Link href={n.link} onClick={() => { markRead(n.id); setOpen(false) }}
                          className="text-xs text-brand-600 font-medium hover:underline">
                          View
                        </Link>
                      )}
                      {!n.isRead && (
                        <button type="button" onClick={() => markRead(n.id)} className="text-xs text-gray-500 hover:text-gray-700">
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
