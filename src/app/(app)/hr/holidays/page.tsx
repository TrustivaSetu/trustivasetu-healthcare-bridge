'use client'

import { useState, useMemo, useCallback } from 'react'
import { useTabSession } from '@/contexts/TabSessionContext'
import {
  INDIA_HOLIDAYS_2025_26,
  getDayName,
  isSunday,
  isSaturday,
  type HolidayType,
  type Religion,
  type IndiaHoliday,
} from '@/lib/hr/india-holidays-2025-26'

// ── Filter state ──────────────────────────────────────────────────────────────

interface Filters {
  type: string
  religion: string
  state: string
  month: string
  search: string
}

const EMPTY_FILTERS: Filters = { type: '', religion: '', state: '', month: '', search: '' }

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

// ── Badge config ──────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<HolidayType, { label: string; dot: string; bg: string; text: string }> = {
  gazetted:   { label: 'Gazetted',   dot: '🟢', bg: 'bg-green-100',  text: 'text-green-800'  },
  restricted: { label: 'Restricted', dot: '🟡', bg: 'bg-yellow-100', text: 'text-yellow-800' },
  festival:   { label: 'Festival',   dot: '🔵', bg: 'bg-blue-100',   text: 'text-blue-800'   },
  regional:   { label: 'Regional',   dot: '🟣', bg: 'bg-purple-100', text: 'text-purple-800' },
}

const RELIGION_ICONS: Record<Religion, string> = {
  National: '🇮🇳', Hindu: '🕉️', Muslim: '☪️', Christian: '✝️',
  Sikh: '☬', Buddhist: '☸️', Jain: '🌀', Parsi: '🔥', Regional: '📍',
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportCSV(rows: IndiaHoliday[]) {
  const headers = ['#', 'Holiday Name', 'Date', 'Day', 'Type', 'Religion/Category', 'State/Region', 'Notes', 'Sunday Warning']
  const lines = [
    headers.join(','),
    ...rows.map((h, i) => {
      const day = getDayName(h.date)
      const warn = isSunday(h.date) ? 'Falls on Sunday – substitute holiday may apply' : ''
      return [
        i + 1,
        `"${h.name}"`,
        h.date,
        day,
        TYPE_CONFIG[h.type].label,
        h.religion,
        `"${h.state ?? ''}"`,
        `"${h.note ?? ''}"`,
        `"${warn}"`,
      ].join(',')
    }),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'india-holidays-2025-26.csv'
  a.click()
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HolidaysPage() {
  const { user: session } = useTabSession()
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [showLegend, setShowLegend] = useState(false)

  const isAdmin = session?.role === 'SUPER_ADMIN' || session?.role === 'ADMIN'

  const allHolidays = INDIA_HOLIDAYS_2025_26

  // Unique options for filter dropdowns
  const stateOptions = useMemo(() =>
    [...new Set(allHolidays.flatMap(h => h.state ? h.state.split(',').map(s => s.trim()) : []))].sort()
  , [allHolidays])

  const filtered = useMemo(() => {
    return allHolidays.filter(h => {
      if (filters.type && h.type !== filters.type) return false
      if (filters.religion && h.religion !== filters.religion) return false
      if (filters.state && !(h.state ?? '').toLowerCase().includes(filters.state.toLowerCase())) return false
      if (filters.month) {
        const month = new Date(h.date + 'T00:00:00Z').getUTCMonth()
        if (month !== parseInt(filters.month)) return false
      }
      if (filters.search) {
        const q = filters.search.toLowerCase()
        if (!h.name.toLowerCase().includes(q) && !(h.note ?? '').toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [allHolidays, filters])

  const stats = useMemo(() => ({
    total: allHolidays.length,
    gazetted: allHolidays.filter(h => h.type === 'gazetted').length,
    restricted: allHolidays.filter(h => h.type === 'restricted').length,
    festival: allHolidays.filter(h => h.type === 'festival').length,
    regional: allHolidays.filter(h => h.type === 'regional').length,
    sundays: allHolidays.filter(h => isSunday(h.date)).length,
  }), [allHolidays])

  const update = useCallback((key: keyof Filters, val: string) =>
    setFilters(f => ({ ...f, [key]: val })), [])

  const handlePrint = () => window.print()

  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #holiday-print-area, #holiday-print-area * { visibility: visible; }
          #holiday-print-area { position: absolute; top: 0; left: 0; width: 100%; }
          .no-print { display: none !important; }
          table { page-break-inside: auto; font-size: 11px; }
          tr { page-break-inside: avoid; }
          thead { display: table-header-group; }
          @page { margin: 1.5cm; size: A4 landscape; }
        }
      `}</style>

      <div className="p-4 sm:p-6 max-w-[1400px] mx-auto space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 no-print">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Indian Holidays & Festivals Calendar</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Jan 2026 – Mar 2027 · {allHolidays.length} entries · Central Govt Gazetted + All religions + Regional
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowLegend(v => !v)}
              className="px-3 py-2 text-xs font-medium border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
            >
              {showLegend ? 'Hide' : 'Show'} Legend
            </button>
            <button
              onClick={() => exportCSV(filtered)}
              className="px-3 py-2 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export CSV
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
              Export PDF
            </button>
          </div>
        </div>

        {/* Stats chips */}
        <div className="flex flex-wrap gap-2 no-print">
          <StatChip label="Total" count={stats.total} color="gray" onClick={() => setFilters(EMPTY_FILTERS)} />
          <StatChip label="Gazetted" count={stats.gazetted} color="green" onClick={() => setFilters({ ...EMPTY_FILTERS, type: 'gazetted' })} />
          <StatChip label="Restricted" count={stats.restricted} color="yellow" onClick={() => setFilters({ ...EMPTY_FILTERS, type: 'restricted' })} />
          <StatChip label="Festivals" count={stats.festival} color="blue" onClick={() => setFilters({ ...EMPTY_FILTERS, type: 'festival' })} />
          <StatChip label="Regional" count={stats.regional} color="purple" onClick={() => setFilters({ ...EMPTY_FILTERS, type: 'regional' })} />
          <StatChip label="Fall on Sunday ⚠️" count={stats.sundays} color="red" onClick={() => {}} />
        </div>

        {/* Legend */}
        {showLegend && (
          <div className="no-print grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 border border-gray-200 rounded-xl p-4">
            {(Object.entries(TYPE_CONFIG) as [HolidayType, typeof TYPE_CONFIG[HolidayType]][]).map(([type, cfg]) => (
              <div key={type} className="flex items-center gap-2 text-sm">
                <span>{cfg.dot}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                <span className="text-gray-500 text-xs">
                  {type === 'gazetted' ? 'Mandatory – Central Govt' :
                   type === 'restricted' ? 'Optional – choose from list' :
                   type === 'festival' ? 'Non-gazetted celebration' : 'State-specific'}
                </span>
              </div>
            ))}
            <div className="col-span-2 sm:col-span-4 border-t pt-3 mt-1 flex flex-wrap gap-3">
              {(Object.entries(RELIGION_ICONS) as [Religion, string][]).map(([r, icon]) => (
                <span key={r} className="text-xs text-gray-600">{icon} {r}</span>
              ))}
            </div>
            <div className="col-span-2 sm:col-span-4 text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
              ⚠️ <strong>Sunday warning:</strong> When a gazetted/restricted holiday falls on Sunday, a substitute holiday is typically notified by the government on the following Monday. Islamic festival dates are approximate — subject to official moon-sighting announcement.
            </div>
          </div>
        )}

        {/* Filter bar */}
        <div className="no-print bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Search */}
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  value={filters.search}
                  onChange={e => update('search', e.target.value)}
                  placeholder="Holiday or keyword..."
                  className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            {/* Type */}
            <FilterSelect
              label="Type"
              value={filters.type}
              onChange={v => update('type', v)}
              options={[
                { value: 'gazetted', label: '🟢 Gazetted' },
                { value: 'restricted', label: '🟡 Restricted' },
                { value: 'festival', label: '🔵 Festival' },
                { value: 'regional', label: '🟣 Regional' },
              ]}
              placeholder="All Types"
            />

            {/* Religion */}
            <FilterSelect
              label="Religion / Category"
              value={filters.religion}
              onChange={v => update('religion', v)}
              options={(['National', 'Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Parsi', 'Regional'] as Religion[]).map(r => ({
                value: r, label: `${RELIGION_ICONS[r]} ${r}`
              }))}
              placeholder="All Religions"
            />

            {/* Month */}
            <FilterSelect
              label="Month"
              value={filters.month}
              onChange={v => update('month', v)}
              options={MONTHS.map((m, i) => ({ value: String(i), label: m }))}
              placeholder="All Months"
            />

            {/* State */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">State / Region</label>
              <input
                value={filters.state}
                onChange={e => update('state', e.target.value)}
                placeholder="e.g. Kerala"
                list="state-list"
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 w-40"
              />
              <datalist id="state-list">
                {stateOptions.map(s => <option key={s} value={s} />)}
              </datalist>
            </div>

            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="px-3 py-1.5 text-sm border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50"
            >
              Reset
            </button>
          </div>

          <p className="text-xs text-gray-400">
            Showing <strong className="text-gray-700">{filtered.length}</strong> of {allHolidays.length} entries
          </p>
        </div>

        {/* Table */}
        <div id="holiday-print-area" className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {/* Print header */}
          <div className="hidden print:block px-6 py-4 border-b">
            <h1 className="text-lg font-bold">Indian Holidays & Festivals — Jan 2026 – Mar 2027</h1>
            <p className="text-sm text-gray-500">Central Govt Gazetted + All Religions + Regional · Printed {new Date().toLocaleDateString('en-IN')}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-left">
                  <th className="px-3 py-3 font-semibold text-gray-600 w-8 text-center">#</th>
                  <th className="px-3 py-3 font-semibold text-gray-600 min-w-[200px]">Holiday / Festival</th>
                  <th className="px-3 py-3 font-semibold text-gray-600 whitespace-nowrap">Date</th>
                  <th className="px-3 py-3 font-semibold text-gray-600 whitespace-nowrap">Day</th>
                  <th className="px-3 py-3 font-semibold text-gray-600">Type</th>
                  <th className="px-3 py-3 font-semibold text-gray-600">Religion / Category</th>
                  <th className="px-3 py-3 font-semibold text-gray-600 min-w-[160px]">State / Region</th>
                  <th className="px-3 py-3 font-semibold text-gray-600 min-w-[220px]">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                      No holidays match the current filters.
                    </td>
                  </tr>
                )}
                {filtered.map((h, i) => {
                  const dayName = getDayName(h.date)
                  const sun = isSunday(h.date)
                  const sat = isSaturday(h.date)
                  const cfg = TYPE_CONFIG[h.type]
                  const d = new Date(h.date + 'T00:00:00Z')
                  const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
                  const year = d.getUTCFullYear()

                  return (
                    <tr
                      key={`${h.date}-${h.name}`}
                      className={`border-b last:border-0 transition-colors ${
                        sun || sat ? 'bg-gray-50 opacity-80' : 'hover:bg-blue-50/30'
                      } ${h.type === 'gazetted' ? 'hover:bg-green-50/40' : ''}`}
                    >
                      {/* # */}
                      <td className="px-3 py-2.5 text-center text-gray-400 text-xs">{i + 1}</td>

                      {/* Name */}
                      <td className="px-3 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          <span className={`font-medium ${sun || sat ? 'text-gray-400' : 'text-gray-800'}`}>
                            {h.name}
                          </span>
                          {sun && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 w-fit">
                              ⚠️ Falls on Sunday — substitute holiday may apply
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`font-mono text-xs ${sun ? 'text-amber-700 font-bold' : 'text-gray-700'}`}>
                          {dateStr}
                        </span>
                      </td>

                      {/* Day */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                          sun ? 'bg-amber-100 text-amber-800' :
                          sat ? 'bg-orange-50 text-orange-700' :
                          'text-gray-600'
                        }`}>
                          {dayName}
                        </span>
                      </td>

                      {/* Type badge */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${cfg.bg} ${cfg.text}`}>
                          {cfg.dot} {cfg.label}
                        </span>
                      </td>

                      {/* Religion */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-xs text-gray-700">
                          {RELIGION_ICONS[h.religion]} {h.religion}
                        </span>
                      </td>

                      {/* State */}
                      <td className="px-3 py-2.5">
                        {h.state ? (
                          <span className="text-xs text-gray-500 italic">{h.state}</span>
                        ) : (
                          <span className="text-xs text-gray-300">All India</span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="px-3 py-2.5 max-w-[260px]">
                        <p className="text-[11px] text-gray-500 leading-relaxed">{h.note}</p>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Footer count */}
          <div className="px-4 py-3 border-t bg-gray-50 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
            <span>
              {filtered.length} record{filtered.length !== 1 ? 's' : ''} shown
              {filters.type || filters.religion || filters.month || filters.state || filters.search
                ? ` (filtered from ${allHolidays.length} total)`
                : ''}
            </span>
            <span className="italic">
              Islamic & lunar dates marked [approx] — subject to official moon-sighting
            </span>
          </div>
        </div>

        {/* Religion-wise summary */}
        <div className="no-print grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {(['National', 'Hindu', 'Muslim', 'Christian', 'Sikh', 'Buddhist', 'Jain', 'Parsi', 'Regional'] as Religion[]).map(r => {
            const count = allHolidays.filter(h => h.religion === r).length
            return (
              <button
                key={r}
                onClick={() => setFilters(f => ({ ...f, religion: f.religion === r ? '' : r }))}
                className={`text-left p-3 rounded-xl border text-sm transition-colors ${
                  filters.religion === r
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}
              >
                <p className="text-lg leading-none mb-1">{RELIGION_ICONS[r]}</p>
                <p className="font-semibold text-gray-800 text-xs">{r}</p>
                <p className="text-gray-400 text-[11px]">{count} entries</p>
              </button>
            )
          })}
        </div>

        {/* Source note */}
        <p className="no-print text-xs text-gray-400 pb-4 leading-relaxed">
          <strong>Sources:</strong> Ministry of Home Affairs Gazetted Holiday list 2025 · Drik Panchang 2025 · Islamic Society of North America (for Hijri dates, approx) · State government notifications. All lunar-based dates (Hindu, Muslim, Jain) are approximate — actual celebration dates may vary by 1–2 days based on regional panchang and moon-sighting. Islamic festival dates are subject to official moon-sighting announcement in India.
        </p>
      </div>
    </>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatChip({ label, count, color, onClick }: {
  label: string; count: number; color: string; onClick: () => void
}) {
  const colors: Record<string, string> = {
    gray:   'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200',
    green:  'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100',
    blue:   'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
    red:    'bg-red-50 text-red-700 border-red-200',
  }
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${colors[color]}`}
    >
      {label}: {count}
    </button>
  )
}

function FilterSelect({ label, value, onChange, options, placeholder }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
      >
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
