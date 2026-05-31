'use client'

import { useState, useEffect, useCallback } from 'react'
import { getRoleLabel, getRoleColor, formatDate, cn } from '@/lib/utils'

interface Employee {
  id: string; name: string; email: string; phone: string | null; role: string; createdAt: string
  employeeProfile: { designation: string | null; department: string | null; dateOfJoining: string | null } | null
}

export default function DirectoryPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchDirectory = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    const res = await fetch(`/api/hr/directory?${p}`)
    const d = await res.json()
    setEmployees(d.data ?? [])
    setLoading(false)
  }, [search])

  useEffect(() => { fetchDirectory() }, [fetchDirectory])

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Employee Directory</h1>
          <p className="text-sm text-gray-500">{employees.length} active employee{employees.length !== 1 ? 's' : ''}</p>
        </div>
        <input type="text" placeholder="Search by name or email..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 w-64" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map(emp => (
            <div key={emp.id} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold text-lg flex-shrink-0">
                  {emp.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{emp.name}</p>
                  <p className="text-xs text-gray-500 truncate">{emp.email}</p>
                  <span className={cn('mt-1 inline-block text-xs px-2 py-0.5 rounded-full font-medium', getRoleColor(emp.role))}>
                    {getRoleLabel(emp.role)}
                  </span>
                </div>
              </div>
              <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-3">
                {emp.employeeProfile?.designation && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    {emp.employeeProfile.designation}
                    {emp.employeeProfile.department && ` · ${emp.employeeProfile.department}`}
                  </div>
                )}
                {emp.phone && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {emp.phone}
                  </div>
                )}
                {emp.employeeProfile?.dateOfJoining && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Joined {formatDate(emp.employeeProfile.dateOfJoining)}
                  </div>
                )}
              </div>
            </div>
          ))}
          {employees.length === 0 && (
            <div className="col-span-3 text-center py-16 text-gray-400">No employees found</div>
          )}
        </div>
      )}
    </div>
  )
}
