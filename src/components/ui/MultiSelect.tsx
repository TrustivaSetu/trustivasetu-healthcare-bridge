'use client'

import { useState, useRef, useEffect } from 'react'

interface Option {
  value: string
  label: string
}

interface Props {
  options: Option[]
  value: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  label?: string
  className?: string
}

export function MultiSelect({ options, value, onChange, placeholder = 'Select...', label, className = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase())
  )

  function toggle(val: string) {
    onChange(value.includes(val) ? value.filter(v => v !== val) : [...value, val])
  }

  function selectAll() {
    onChange(filtered.map(o => o.value))
  }

  function clearAll() {
    onChange([])
  }

  const selectedLabels = value
    .map(v => options.find(o => o.value === v)?.label ?? v)
    .join(', ')

  return (
    <div ref={ref} className={`relative ${className}`}>
      {label && <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-left focus:outline-none focus:ring-2 focus:ring-brand-400 flex items-center justify-between gap-1"
      >
        <span className={`truncate ${value.length === 0 ? 'text-gray-400' : 'text-gray-800'}`}>
          {value.length === 0 ? placeholder : `${value.length} selected`}
        </span>
        <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {value.length > 0 && (
        <p className="text-xs text-gray-500 mt-0.5 truncate">{selectedLabels}</p>
      )}

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 px-2 py-1.5 border-b border-gray-100">
            <button type="button" onClick={selectAll}
              className="text-xs text-blue-600 hover:underline">Select All</button>
            <span className="text-gray-300">|</span>
            <button type="button" onClick={clearAll}
              className="text-xs text-red-500 hover:underline">Clear All</button>
            <span className="ml-auto text-xs text-gray-400">{value.length}/{options.length}</span>
          </div>

          {/* Options */}
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">No results</p>
            ) : (
              filtered.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggle(o.value)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-gray-50 transition-colors ${
                    value.includes(o.value) ? 'bg-blue-50' : ''
                  }`}
                >
                  <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center text-white transition-colors ${
                    value.includes(o.value) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                  }`}>
                    {value.includes(o.value) && (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </span>
                  <span className="truncate text-gray-700">{o.label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
