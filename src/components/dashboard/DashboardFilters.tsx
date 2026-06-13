'use client'

import { useEffect, useState } from 'react'

interface FilterState {
  dateFrom: string
  dateTo: string
  regionId: string
  clinicId: string
  lenderId: string
  rmId: string
}

interface Props {
  filters: FilterState
  onChange: (f: FilterState) => void
  showExport?: boolean
  onExport?: () => void
}

export function DashboardFilters({ filters, onChange, showExport, onExport }: Props) {
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([])
  const [clinics, setClinics] = useState<{ id: string; name: string }[]>([])
  const [lenders, setLenders] = useState<{ id: string; name: string }[]>([])
  const [rms, setRms] = useState<{ id: string; name: string }[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/regions').then(r => r.json()),
      fetch('/api/clinics?minimal=1').then(r => r.json()),
      fetch('/api/lenders').then(r => r.json()),
      fetch('/api/users?role=REGIONAL_MANAGER&minimal=1').then(r => r.json()),
    ]).then(([r, c, l, u]) => {
      setRegions(r.data ?? [])
      setClinics(c.data ?? [])
      setLenders(l.data ?? [])
      setRms(u.data ?? [])
    })
  }, [])

  function update(key: keyof FilterState, value: string) {
    onChange({ ...filters, [key]: value })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">From</label>
          <input type="date" value={filters.dateFrom} onChange={e => update('dateFrom', e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-600">To</label>
          <input type="date" value={filters.dateTo} onChange={e => update('dateTo', e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>
        <FilterSelect label="Region" value={filters.regionId} onChange={v => update('regionId', v)}
          options={regions} placeholder="All Regions" />
        <FilterSelect label="Channel Partner" value={filters.clinicId} onChange={v => update('clinicId', v)}
          options={clinics} placeholder="All Channel Partners" />
        <FilterSelect label="Lender" value={filters.lenderId} onChange={v => update('lenderId', v)}
          options={lenders} placeholder="All Lenders" />
        <FilterSelect label="RM" value={filters.rmId} onChange={v => update('rmId', v)}
          options={rms} placeholder="All RMs" />

        <button
          onClick={() => onChange({ dateFrom: '', dateTo: '', regionId: '', clinicId: '', lenderId: '', rmId: '' })}
          className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
        >
          Reset
        </button>

        {showExport && (
          <button
            onClick={onExport}
            className="ml-auto px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Excel
          </button>
        )}
      </div>
    </div>
  )
}

function FilterSelect({ label, value, onChange, options, placeholder }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { id: string; name: string }[]
  placeholder: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white">
        <option value="">{placeholder}</option>
        {options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
    </div>
  )
}
