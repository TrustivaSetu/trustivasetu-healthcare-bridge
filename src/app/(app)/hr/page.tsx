'use client'

import { useState, useEffect } from 'react'
import { useTabSession } from '@/contexts/TabSessionContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getRoleLabel, formatDate, cn } from '@/lib/utils'
import { format } from 'date-fns'

interface Employee {
  id: string; name: string; email: string; role: string
  employeeProfile: { designation: string | null; department: string | null; dateOfJoining: string | null; dateOfBirth: string | null } | null
}
interface Holiday { id: string; name: string; date: string }

export default function HRPage() {
  const { user: session } = useTabSession()
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [loading, setLoading] = useState(true)

  const isAdmin = session?.role === 'SUPER_ADMIN' || session?.role === 'ADMIN'

  useEffect(() => {
    if (session && !isAdmin) { router.push('/hr/my-profile'); return }
    Promise.all([
      fetch('/api/hr/directory').then(r => r.json()),
      fetch(`/api/hr/holidays?year=${new Date().getFullYear()}`).then(r => r.json()),
    ]).then(([emp, hol]) => {
      setEmployees(emp.data ?? [])
      setHolidays(hol.data ?? [])
      setLoading(false)
    })
  }, [session, isAdmin, router])

  const today = new Date()
  // Use IST month for comparison (IST = UTC+5:30)
  const istNow = new Date(today.getTime() + (5 * 60 + 30) * 60 * 1000)
  const thisMonth = istNow.getUTCMonth()
  const upcomingHolidays = holidays.filter(h => new Date(h.date) >= today).slice(0, 5)
  const birthdaysThisMonth = employees.filter(e => {
    const dob = e.employeeProfile?.dateOfBirth
    if (!dob) return false
    return new Date(dob).getUTCMonth() === thisMonth
  })

  const quickLinks = [
    { href: '/hr/my-profile', label: 'My Profile', icon: '👤', desc: 'View and edit your profile', color: 'bg-blue-50 border-blue-200' },
    { href: '/hr/attendance', label: 'Attendance', icon: '📅', desc: 'Mark and track attendance', color: 'bg-green-50 border-green-200' },
    { href: '/hr/payslip', label: 'Payslip', icon: '💰', desc: 'View monthly payslip', color: 'bg-yellow-50 border-yellow-200' },
    { href: '/hr/directory', label: 'Directory', icon: '📋', desc: 'Employee directory', color: 'bg-purple-50 border-purple-200' },
    { href: '/hr/salary', label: 'Salary Management', icon: '📊', desc: 'Set employee salaries', color: 'bg-red-50 border-red-200' },
    { href: '/hr/holidays', label: 'Holidays', icon: '🎉', desc: 'Manage holiday calendar', color: 'bg-orange-50 border-orange-200' },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">HR Management</h1>
        <p className="text-sm text-gray-500">Employee records, attendance, payroll, and more</p>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {quickLinks.map(ql => (
          <Link key={ql.href} href={ql.href}
            className={cn('border rounded-xl p-4 hover:shadow-md transition block', ql.color)}>
            <div className="text-2xl mb-2">{ql.icon}</div>
            <p className="font-semibold text-gray-800 text-sm">{ql.label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{ql.desc}</p>
          </Link>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Employee overview */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center">
              <p className="text-sm font-semibold text-gray-700">Employees ({employees.length})</p>
              <Link href="/hr/directory" className="text-xs text-brand-600 hover:text-brand-800">View all →</Link>
            </div>
            <div className="divide-y divide-gray-100">
              {employees.slice(0, 8).map(emp => (
                <div key={emp.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-semibold text-sm flex-shrink-0">
                    {emp.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{emp.name}</p>
                    <p className="text-xs text-gray-500">{emp.employeeProfile?.designation ?? getRoleLabel(emp.role)}</p>
                  </div>
                  {emp.employeeProfile?.dateOfJoining && (
                    <span className="text-xs text-gray-400 hidden md:block">{formatDate(emp.employeeProfile.dateOfJoining)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Upcoming holidays */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 flex justify-between">
                <p className="text-sm font-semibold text-gray-700">Upcoming Holidays</p>
                <Link href="/hr/holidays" className="text-xs text-brand-600 hover:text-brand-800">Manage →</Link>
              </div>
              <div className="divide-y divide-gray-100">
                {upcomingHolidays.length === 0 && <p className="text-xs text-gray-400 p-4 text-center">No upcoming holidays</p>}
                {upcomingHolidays.map(h => (
                  <div key={h.id} className="px-4 py-2.5 flex items-center gap-3">
                    <div className="w-9 h-9 bg-yellow-100 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-[10px] font-bold text-yellow-700 uppercase leading-none">{format(new Date(h.date), 'MMM')}</span>
                      <span className="text-sm font-bold text-gray-800 leading-none">{format(new Date(h.date), 'dd')}</span>
                    </div>
                    <p className="text-sm text-gray-700 font-medium">{h.name}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Birthdays this month */}
            {birthdaysThisMonth.length > 0 && (
              <div className="bg-pink-50 border border-pink-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-pink-200">
                  <p className="text-sm font-semibold text-pink-800">Birthdays This Month</p>
                </div>
                <div className="divide-y divide-pink-100 p-2">
                  {birthdaysThisMonth.map(emp => (
                    <div key={emp.id} className="px-2 py-2 flex items-center gap-2">
                      <span className="text-lg">🎂</span>
                      <div>
                        <p className="text-sm font-medium text-gray-800">{emp.name}</p>
                        <p className="text-xs text-pink-600">
                          {format(new Date(emp.employeeProfile!.dateOfBirth!), 'dd MMM')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
