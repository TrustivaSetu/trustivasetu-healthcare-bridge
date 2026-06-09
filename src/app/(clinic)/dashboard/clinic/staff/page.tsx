'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatLakhs } from '@/lib/utils'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const ROLE_BADGE: Record<string, string> = {
  REGIONAL_MANAGER: 'bg-purple-100 text-purple-700',
  TEAM_MEMBER: 'bg-blue-100 text-blue-700',
  ADMIN: 'bg-red-100 text-red-700',
  SUPER_ADMIN: 'bg-red-100 text-red-700',
}

const ROLE_LABEL: Record<string, string> = {
  REGIONAL_MANAGER: 'RM',
  TEAM_MEMBER: 'TM',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Admin',
}

interface StaffMember {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
  designation: string | null
  department: string | null
  leads: { total: number; disbursed: number; disbursedValue: number }
  attendance: { present: number; leave: number; outstation: number; halfDay: number }
}

export default function StaffReportPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<'xlsx' | 'pdf' | null>(null)

  const fetchStaff = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/clinic/staff?month=${month}&year=${year}`)
      const data = await res.json()
      setStaff(data.data ?? [])
    } catch {
      toast.error('Failed to load staff data')
    } finally {
      setLoading(false)
    }
  }, [month, year])

  useEffect(() => { fetchStaff() }, [fetchStaff])

  async function downloadReport(format: 'xlsx' | 'pdf') {
    setDownloading(format)
    try {
      const res = await fetch(`/api/clinic/staff/report?month=${month}&year=${year}&format=${format}`)
      if (!res.ok) { toast.error('Failed to generate report'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `staff-report-${MONTHS[month - 1]}-${year}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Staff report ${format.toUpperCase()} downloaded`)
    } catch {
      toast.error('Something went wrong')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Staff Report</h1>
            <p className="text-sm text-gray-500">
              Assigned field staff — leads and attendance for {MONTHS[month - 1]} {year}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={month}
              onChange={e => setMonth(Number(e.target.value))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-trustiva-navy"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <select
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-trustiva-navy"
            >
              {[now.getFullYear() - 1, now.getFullYear()].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => downloadReport('xlsx')}
              disabled={downloading !== null}
              className="flex items-center gap-1.5 bg-[#07111f] text-[#bef264] font-semibold text-sm px-3 py-2 rounded-lg hover:bg-gray-800 transition disabled:opacity-60"
            >
              {downloading === 'xlsx'
                ? <div className="w-4 h-4 animate-spin rounded-full border-2 border-trustiva-lime border-t-transparent" />
                : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              }
              Excel
            </button>
            <button
              type="button"
              onClick={() => downloadReport('pdf')}
              disabled={downloading !== null}
              className="flex items-center gap-1.5 bg-red-600 text-white font-semibold text-sm px-3 py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-60"
            >
              {downloading === 'pdf'
                ? <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
              }
              PDF
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-trustiva-lime border-t-transparent" />
          </div>
        ) : staff.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-gray-500 text-sm font-medium">No staff assigned to this clinic</p>
            <p className="text-gray-400 text-xs mt-1">Contact your Trustiva representative to get team members assigned.</p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <SummaryCard label="Total Staff" value={staff.length} color="blue" />
              <SummaryCard
                label="Total Leads"
                value={staff.reduce((s, m) => s + m.leads.total, 0)}
                color="indigo"
              />
              <SummaryCard
                label="Disbursed Leads"
                value={staff.reduce((s, m) => s + m.leads.disbursed, 0)}
                color="green"
              />
              <SummaryCard
                label="Disbursal Value"
                value={formatLakhs(staff.reduce((s, m) => s + m.leads.disbursedValue, 0))}
                color="emerald"
                isText
              />
            </div>

            {/* Staff table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Staff Member', 'Role', 'Leads', 'Disbursed', 'Disbursal Value', 'Present', 'Leave', 'Outstation', 'Contact'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {staff.map(member => (
                      <tr key={member.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-gray-800">{member.name}</p>
                          {member.designation && (
                            <p className="text-xs text-gray-400 mt-0.5">{member.designation}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', ROLE_BADGE[member.role] ?? 'bg-gray-100 text-gray-600')}>
                            {ROLE_LABEL[member.role] ?? member.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-blue-700">
                          {member.leads.total}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-green-700">
                          {member.leads.disbursed}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {member.leads.disbursedValue > 0 ? formatLakhs(member.leads.disbursedValue) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <AttendancePill value={member.attendance.present} type="present" halfDay={member.attendance.halfDay} />
                        </td>
                        <td className="px-4 py-3">
                          <AttendancePill value={member.attendance.leave} type="leave" />
                        </td>
                        <td className="px-4 py-3">
                          <AttendancePill value={member.attendance.outstation} type="outstation" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs text-gray-500 space-y-0.5">
                            {member.phone && <p>{member.phone}</p>}
                            <p className="truncate max-w-[140px]">{member.email}</p>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-xs text-gray-400 text-center">
              Attendance data shown is for {MONTHS[month - 1]} {year} only.
              Lead counts include leads created by each staff member for this clinic in the selected period.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function SummaryCard({
  label, value, color, isText,
}: {
  label: string
  value: number | string
  color: string
  isText?: boolean
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-100 text-blue-700',
    indigo: 'bg-indigo-50 border-indigo-100 text-indigo-700',
    green: 'bg-green-50 border-green-100 text-green-700',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700',
  }
  return (
    <div className={cn('rounded-xl border p-4', colors[color] ?? 'bg-gray-50 border-gray-100 text-gray-700')}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className={cn('font-bold', isText ? 'text-lg' : 'text-2xl')}>{value}</p>
    </div>
  )
}

function AttendancePill({
  value, type, halfDay,
}: {
  value: number
  type: 'present' | 'leave' | 'outstation'
  halfDay?: number
}) {
  if (value === 0) return <span className="text-xs text-gray-400">—</span>

  const styles = {
    present: 'bg-green-100 text-green-700',
    leave: 'bg-yellow-100 text-yellow-700',
    outstation: 'bg-purple-100 text-purple-700',
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold w-fit', styles[type])}>
        {value}d
      </span>
      {type === 'present' && halfDay != null && halfDay > 0 && (
        <span className="text-[10px] text-gray-400">{halfDay} half-day</span>
      )}
    </div>
  )
}
