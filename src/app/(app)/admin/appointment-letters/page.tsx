'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTabSession } from '@/contexts/TabSessionContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

interface Letter {
  id: string; letterNumber: string; version: number; status: string
  employeeName: string; designation: string | null; department: string | null
  acknowledgedAt: string | null; createdAt: string; isArchived: boolean
  user: { id: string; name: string; email: string; employeeProfile: { designation: string | null; department: string | null } | null }
}

const STATUS_STYLE: Record<string, string> = {
  PENDING_ACKNOWLEDGEMENT: 'bg-amber-100 text-amber-700',
  ACKNOWLEDGED: 'bg-green-100 text-green-700',
}
const STATUS_LABEL: Record<string, string> = {
  PENDING_ACKNOWLEDGEMENT: 'Pending Acknowledgement',
  ACKNOWLEDGED: 'Acknowledged',
}

export default function AppointmentLettersPage() {
  const { user: session } = useTabSession()
  const router = useRouter()
  const [letters, setLetters] = useState<Letter[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [search, setSearch] = useState('')

  const isAdmin = session?.role === 'SUPER_ADMIN' || session?.role === 'ADMIN'

  useEffect(() => {
    if (session && !isAdmin) router.push('/dashboard')
  }, [session, isAdmin, router])

  const fetchLetters = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (filterStatus) p.set('status', filterStatus)
    const res = await fetch(`/api/hr/appointment-letter?${p}`)
    const d = await res.json()
    setLetters(d.data ?? [])
    setLoading(false)
  }, [filterStatus])

  useEffect(() => { fetchLetters() }, [fetchLetters])

  async function resend(id: string, name: string) {
    const res = await fetch(`/api/hr/appointment-letter/${id}/resend`, { method: 'POST' })
    if (res.ok) toast.success(`Email resent to ${name}`)
    else toast.error('Failed to resend')
  }

  async function generateForUser(userId: string) {
    const res = await fetch('/api/hr/appointment-letter', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    const d = await res.json()
    if (d.noSalary) toast.error('Salary not configured for this employee')
    else if (d.alreadyExists) toast('Letter already exists for this employee')
    else if (d.data) { toast.success('Letter generated!'); fetchLetters() }
    else toast.error(d.error ?? 'Failed')
  }

  const filtered = letters.filter(l =>
    !search ||
    l.employeeName.toLowerCase().includes(search.toLowerCase()) ||
    l.user.email.toLowerCase().includes(search.toLowerCase()) ||
    l.letterNumber.toLowerCase().includes(search.toLowerCase())
  )

  const stats = {
    total: letters.length,
    pending: letters.filter(l => l.status === 'PENDING_ACKNOWLEDGEMENT').length,
    acknowledged: letters.filter(l => l.status === 'ACKNOWLEDGED').length,
  }

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Appointment Letters</h1>
        <p className="text-sm text-gray-500">Manage and track employee appointment letters</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Letters', value: stats.total, color: 'bg-gray-50 border-gray-200 text-gray-700' },
          { label: 'Pending Acknowledgement', value: stats.pending, color: 'bg-amber-50 border-amber-200 text-amber-700' },
          { label: 'Acknowledged', value: stats.acknowledged, color: 'bg-green-50 border-green-200 text-green-700' },
        ].map(s => (
          <div key={s.label} className={cn('border rounded-xl p-4 text-center', s.color)}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="text" placeholder="Search by name, email, letter no..." value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 w-72" />
        <div className="flex gap-2">
          {['', 'PENDING_ACKNOWLEDGEMENT', 'ACKNOWLEDGED'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={cn('px-3 py-1.5 text-xs font-medium rounded-full border transition',
                filterStatus === s ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-600 hover:border-brand-300')}>
              {s === '' ? 'All' : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center text-gray-400 text-sm">
          No appointment letters found
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Employee', 'Letter No.', 'Designation', 'Status', 'Generated', 'Acknowledged', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-gray-800">{l.user.name}</p>
                      <p className="text-xs text-gray-400">{l.user.email}</p>
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-700">{l.letterNumber}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{l.designation ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', STATUS_STYLE[l.status])}>
                        {STATUS_LABEL[l.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(l.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {l.acknowledgedAt ? formatDate(l.acknowledgedAt) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        <Link href={`/hr/appointment-letter/${l.id}`}
                          className="text-xs text-brand-600 hover:text-brand-800 font-medium">View</Link>
                        <button onClick={() => resend(l.id, l.user.name)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Resend</button>
                        <button onClick={() => generateForUser(l.user.id)}
                          className="text-xs text-gray-500 hover:text-gray-700 font-medium">Regenerate</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
