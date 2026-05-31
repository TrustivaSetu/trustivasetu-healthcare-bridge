'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTabSession } from '@/contexts/TabSessionContext'
import { formatDate, cn } from '@/lib/utils'
import { format, isSameMonth } from 'date-fns'
import toast from 'react-hot-toast'

interface Holiday { id: string; name: string; date: string }

export default function HolidaysPage() {
  const { user: session } = useTabSession()
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', date: '' })
  const [saving, setSaving] = useState(false)

  const isAdmin = session?.role === 'SUPER_ADMIN' || session?.role === 'ADMIN'

  const fetchHolidays = useCallback(async () => {
    const res = await fetch(`/api/hr/holidays?year=${year}`)
    const d = await res.json()
    setHolidays(d.data ?? [])
  }, [year])

  useEffect(() => { fetchHolidays() }, [fetchHolidays])

  async function addHoliday() {
    if (!form.name || !form.date) return
    setSaving(true)
    const res = await fetch('/api/hr/holidays', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.ok) { toast.success('Holiday added'); setShowForm(false); setForm({ name: '', date: '' }); fetchHolidays() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
    setSaving(false)
  }

  async function deleteHoliday(id: string) {
    if (!confirm('Delete this holiday?')) return
    const res = await fetch(`/api/hr/holidays?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Holiday removed'); fetchHolidays() }
    else toast.error('Failed to delete')
  }

  // Group holidays by month
  const grouped: Record<number, Holiday[]> = {}
  for (const h of holidays) {
    const m = new Date(h.date).getUTCMonth()
    if (!grouped[m]) grouped[m] = []
    grouped[m].push(h)
  }

  const today = new Date()
  const upcoming = holidays.filter(h => new Date(h.date) >= today).slice(0, 3)

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Holiday Calendar</h1>
          <p className="text-sm text-gray-500">{holidays.length} holidays in {year}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button onClick={() => setYear(y => y - 1)} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="px-3 text-sm font-semibold text-gray-800">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          {isAdmin && (
            <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700">
              + Add Holiday
            </button>
          )}
        </div>
      </div>

      {/* Upcoming holidays */}
      {upcoming.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-yellow-800 mb-2">Upcoming Holidays</p>
          <div className="flex flex-wrap gap-3">
            {upcoming.map(h => {
              const d = new Date(h.date)
              const isThisMonth = isSameMonth(d, today)
              return (
                <div key={h.id} className="flex items-center gap-2 bg-white border border-yellow-200 rounded-lg px-3 py-2">
                  <div className="text-center">
                    <p className="text-xs font-bold text-yellow-700 uppercase">{format(d, 'MMM')}</p>
                    <p className="text-lg font-bold text-gray-800 leading-none">{format(d, 'dd')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{h.name}</p>
                    {isThisMonth && <p className="text-xs text-yellow-600">This month</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Grouped by month */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(grouped).sort(([a], [b]) => Number(a) - Number(b)).map(([month, monthHolidays]) => (
          <div key={month} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
              <p className="text-sm font-semibold text-gray-700">
                {format(new Date(year, Number(month), 1), 'MMMM')}
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {monthHolidays.map(h => {
                const d = new Date(h.date)
                const dayName = format(d, 'EEE')
                return (
                  <div key={h.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-yellow-100 rounded-lg flex flex-col items-center justify-center">
                        <span className="text-xs font-bold text-yellow-700 uppercase">{dayName}</span>
                        <span className="text-base font-bold text-gray-800 leading-none">{format(d, 'dd')}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-800">{h.name}</span>
                    </div>
                    {isAdmin && (
                      <button onClick={() => deleteHoliday(h.id)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {holidays.length === 0 && (
          <div className="col-span-2 text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
            No holidays found for {year}
          </div>
        )}
      </div>

      {/* Add holiday modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-semibold text-gray-800">Add Holiday</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Holiday Name *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Diwali"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={addHoliday} disabled={saving || !form.name || !form.date}
                className="flex-1 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-60">
                {saving ? 'Adding...' : 'Add Holiday'}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
