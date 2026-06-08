'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTabSession } from '@/contexts/TabSessionContext'
import { format, isSameMonth, isWeekend, getDay } from 'date-fns'
import toast from 'react-hot-toast'

interface Holiday { id: string; name: string; date: string }

// Hindu calendar holidays for 2026 (Gregorian dates)
const HINDU_HOLIDAYS_2026 = [
  { name: 'New Year\'s Day',      date: '2026-01-01' },
  { name: 'Makar Sankranti',      date: '2026-01-14' },
  { name: 'Vasant Panchami',      date: '2026-02-01' },
  { name: 'Maha Shivratri',       date: '2026-02-26' },
  { name: 'Holi',                 date: '2026-03-22' },
  { name: 'Holika Dahan',         date: '2026-03-21' },
  { name: 'Ram Navami',           date: '2026-04-08' },
  { name: 'Mahavir Jayanti',      date: '2026-04-10' },
  { name: 'Good Friday',          date: '2026-04-03' },
  { name: 'Dr. Ambedkar Jayanti', date: '2026-04-14' },
  { name: 'Hanuman Jayanti',      date: '2026-04-23' },
  { name: 'Eid ul-Fitr',          date: '2026-03-20' },
  { name: 'Eid ul-Adha',          date: '2026-05-27' },
  { name: 'Buddha Purnima',       date: '2026-05-21' },
  { name: 'Eid-e-Milad',          date: '2026-09-04' },
  { name: 'Independence Day',     date: '2026-08-15' },
  { name: 'Raksha Bandhan',       date: '2026-08-22' },
  { name: 'Janmashtami',          date: '2026-08-30' },
  { name: 'Ganesh Chaturthi',     date: '2026-09-01' },
  { name: 'Gandhi Jayanti',       date: '2026-10-02' },
  { name: 'Navratri (Shardiya)',  date: '2026-10-09' },
  { name: 'Dussehra (Vijaya Dashami)', date: '2026-10-19' },
  { name: 'Karwa Chauth',         date: '2026-10-29' },
  { name: 'Diwali (Lakshmi Puja)', date: '2026-11-08' },
  { name: 'Naraka Chaturdashi',   date: '2026-11-07' },
  { name: 'Govardhan Puja',       date: '2026-11-09' },
  { name: 'Bhai Dooj',            date: '2026-11-10' },
  { name: 'Chhath Puja',          date: '2026-11-12' },
  { name: 'Guru Nanak Jayanti',   date: '2026-11-23' },
  { name: 'Christmas',            date: '2026-12-25' },
  { name: 'New Year\'s Eve',      date: '2026-12-31' },
]

export default function HolidaysPage() {
  const { user: session } = useTabSession()
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', date: '' })
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)

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

  async function seedHolidays() {
    if (!confirm(`Seed ${HINDU_HOLIDAYS_2026.length} standard Hindu calendar holidays for 2026? Duplicates will be skipped.`)) return
    setSeeding(true)
    let added = 0
    for (const h of HINDU_HOLIDAYS_2026) {
      const res = await fetch('/api/hr/holidays', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(h),
      })
      if (res.ok) added++
    }
    toast.success(`Seeded ${added} holidays`)
    fetchHolidays()
    setSeeding(false)
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

  function getDayInfo(dateStr: string) {
    const d = new Date(dateStr)
    const dayIdx = getDay(d) // 0=Sun, 6=Sat
    const isSun = dayIdx === 0
    const isSat = dayIdx === 6
    const isOff = isSun || isSat
    const dayName = format(d, 'EEE')
    return { isSun, isSat, isOff, dayName }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Holiday Calendar</h1>
          <p className="text-sm text-gray-500">{holidays.length} holidays in {year}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <button onClick={() => setYear(y => y - 1)} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="px-3 text-sm font-semibold text-gray-800">{year}</span>
            <button onClick={() => setYear(y => y + 1)} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>
          {isAdmin && year === 2026 && holidays.length === 0 && (
            <button
              onClick={seedHolidays}
              disabled={seeding}
              className="px-4 py-2 bg-orange-500 text-white text-sm font-medium rounded-lg hover:bg-orange-600 disabled:opacity-60"
            >
              {seeding ? 'Seeding...' : '🪔 Load 2026 Hindu Holidays'}
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700">
              + Add Holiday
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-yellow-100 border border-yellow-300 inline-block" />Normal holiday</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-300 inline-block" />Falls on Sunday/Saturday (already off)</div>
      </div>

      {/* Upcoming holidays */}
      {upcoming.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-yellow-800 mb-2">Upcoming Holidays</p>
          <div className="flex flex-wrap gap-3">
            {upcoming.map(h => {
              const d = new Date(h.date)
              const isThisMonth = isSameMonth(d, today)
              const { isOff } = getDayInfo(h.date)
              return (
                <div key={h.id} className={`flex items-center gap-2 border rounded-lg px-3 py-2 ${isOff ? 'bg-gray-50 border-gray-200 opacity-70' : 'bg-white border-yellow-200'}`}>
                  <div className="text-center">
                    <p className="text-xs font-bold text-yellow-700 uppercase">{format(d, 'MMM')}</p>
                    <p className="text-lg font-bold text-gray-800 leading-none">{format(d, 'dd')}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{h.name}</p>
                    {isThisMonth && <p className="text-xs text-yellow-600">This month</p>}
                    {isOff && <p className="text-xs text-gray-400">Weekend</p>}
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
                <span className="ml-2 text-xs font-normal text-gray-400">{monthHolidays.length} holiday{monthHolidays.length > 1 ? 's' : ''}</span>
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {monthHolidays.map(h => {
                const d = new Date(h.date)
                const { isSun, isSat, isOff, dayName } = getDayInfo(h.date)
                return (
                  <div key={h.id} className={`px-4 py-3 flex items-center justify-between ${isOff ? 'bg-gray-50 opacity-75' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex flex-col items-center justify-center ${isOff ? 'bg-gray-100' : 'bg-yellow-100'}`}>
                        <span className={`text-xs font-bold uppercase ${isOff ? 'text-gray-400' : 'text-yellow-700'}`}>{dayName}</span>
                        <span className="text-base font-bold text-gray-800 leading-none">{format(d, 'dd')}</span>
                      </div>
                      <div>
                        <span className={`text-sm font-medium ${isOff ? 'text-gray-400' : 'text-gray-800'}`}>{h.name}</span>
                        {isSun && <p className="text-xs text-gray-400">Sunday — already a day off</p>}
                        {isSat && <p className="text-xs text-gray-400">Saturday — already a day off</p>}
                      </div>
                    </div>
                    {isAdmin && (
                      <button onClick={() => deleteHoliday(h.id)} className="text-xs text-red-500 hover:text-red-700 flex-shrink-0">Remove</button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {holidays.length === 0 && (
          <div className="col-span-2 text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
            <p className="text-3xl mb-3">🪔</p>
            <p className="font-medium">No holidays found for {year}</p>
            {isAdmin && year === 2026 && (
              <p className="text-sm mt-2">Click <strong>Load 2026 Hindu Holidays</strong> above to pre-populate</p>
            )}
          </div>
        )}
      </div>

      {/* Full year table view */}
      {holidays.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <p className="text-sm font-semibold text-gray-700">All Holidays — {year}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="px-4 py-2 text-left font-semibold text-gray-600 w-8">#</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Holiday</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Date</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Day</th>
                  <th className="px-4 py-2 text-left font-semibold text-gray-600">Note</th>
                </tr>
              </thead>
              <tbody>
                {[...holidays].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((h, i) => {
                  const { isSun, isSat, isOff, dayName } = getDayInfo(h.date)
                  return (
                    <tr key={h.id} className={`border-b last:border-0 ${isOff ? 'bg-gray-50 text-gray-400' : 'hover:bg-yellow-50'}`}>
                      <td className="px-4 py-2">{i + 1}</td>
                      <td className={`px-4 py-2 font-medium ${isOff ? 'text-gray-400' : 'text-gray-800'}`}>{h.name}</td>
                      <td className="px-4 py-2 tabular-nums">{format(new Date(h.date), 'dd MMM yyyy')}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${isOff ? 'bg-gray-100 text-gray-400' : 'bg-yellow-100 text-yellow-800'}`}>
                          {dayName}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-400">
                        {isSun ? 'Already off (Sunday)' : isSat ? 'Already off (Saturday)' : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
                {form.date && (() => {
                  const { isOff, dayName } = getDayInfo(form.date)
                  return isOff ? (
                    <p className="text-xs text-amber-600 mt-1">⚠ {dayName} — this day is already a weekend day off</p>
                  ) : (
                    <p className="text-xs text-gray-400 mt-1">{dayName}</p>
                  )
                })()}
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
