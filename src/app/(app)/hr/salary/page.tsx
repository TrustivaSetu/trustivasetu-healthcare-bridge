'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTabSession } from '@/contexts/TabSessionContext'
import { useRouter } from 'next/navigation'
import { getRoleLabel, cn } from '@/lib/utils'
import { formatINR, calculateSalary } from '@/lib/hr/salary'
import toast from 'react-hot-toast'

interface User { id: string; name: string; email: string; role: string }
interface Salary { grossSalary: number; tds: number }

export default function SalaryPage() {
  const { user: session } = useTabSession()
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [salary, setSalary] = useState<Salary | null>(null)
  const [grossInput, setGrossInput] = useState('')
  const [tdsInput, setTdsInput] = useState('0')
  const [saving, setSaving] = useState(false)
  const [loadingSalary, setLoadingSalary] = useState(false)

  const isAdmin = session?.role === 'SUPER_ADMIN' || session?.role === 'ADMIN'

  useEffect(() => {
    if (session && !isAdmin) { router.push('/dashboard'); return }
    fetch('/api/users?minimal=1').then(r => r.json()).then(d => setUsers(d.data ?? []))
  }, [session, isAdmin, router])

  const fetchSalary = useCallback(async (userId: string) => {
    setLoadingSalary(true)
    const res = await fetch(`/api/hr/salary/${userId}`)
    const d = await res.json()
    if (d.data) {
      setSalary(d.data)
      setGrossInput(String(d.data.grossSalary))
      setTdsInput(String(d.data.tds ?? 0))
    } else {
      setSalary(null); setGrossInput(''); setTdsInput('0')
    }
    setLoadingSalary(false)
  }, [])

  useEffect(() => { if (selectedUser) fetchSalary(selectedUser.id) }, [selectedUser, fetchSalary])

  async function saveSalary() {
    if (!selectedUser) return
    const gross = parseFloat(grossInput)
    if (isNaN(gross) || gross <= 0) { toast.error('Enter a valid gross salary'); return }
    setSaving(true)
    const res = await fetch(`/api/hr/salary/${selectedUser.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grossSalary: gross, tds: parseFloat(tdsInput) || 0 }),
    })
    if (res.ok) { const d = await res.json(); setSalary(d.data); toast.success('Salary saved') }
    else toast.error('Failed to save salary')
    setSaving(false)
  }

  const gross = parseFloat(grossInput) || 0
  const tds = parseFloat(tdsInput) || 0
  const preview = gross > 0 ? calculateSalary(gross, tds) : null

  const rows = preview ? [
    { label: 'Basic Salary (40%)', value: preview.basic, type: 'earning' },
    { label: 'HRA (20% of Gross)', value: preview.hra, type: 'earning' },
    { label: 'Special Allowance', value: preview.specialAllowance, type: 'earning' },
    { label: 'Conveyance Allowance', value: preview.conveyance, type: 'earning' },
    { label: 'Medical Allowance', value: preview.medicalAllowance, type: 'earning' },
    { label: 'LTA (8.33% of Basic)', value: preview.lta, type: 'earning' },
    { label: 'Bonus/Variable (8.33% of Basic)', value: preview.bonus, type: 'earning' },
    { label: 'Employee PF (12% of Basic)', value: preview.employeePF, type: 'deduction' },
    { label: 'Professional Tax', value: preview.professionalTax, type: 'deduction' },
    { label: 'TDS', value: preview.tds, type: 'deduction' },
    { label: 'Employer PF (12% of Basic)', value: preview.employerPF, type: 'ctc' },
    { label: 'Gratuity (4.81% of Basic)', value: preview.gratuity, type: 'ctc' },
  ] : []

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Salary Management</h1>
        <p className="text-sm text-gray-500">Set and view employee salary structures</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee list */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <p className="text-sm font-semibold text-gray-700">Select Employee</p>
          </div>
          <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
            {users.map(u => (
              <button key={u.id} onClick={() => setSelectedUser(u)}
                className={cn('w-full text-left px-4 py-3 hover:bg-gray-50 transition flex items-center gap-3',
                  selectedUser?.id === u.id && 'bg-brand-50')}>
                <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-semibold text-sm flex-shrink-0">
                  {u.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                  <p className="text-xs text-gray-500">{getRoleLabel(u.role)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Salary editor */}
        <div className="lg:col-span-2 space-y-4">
          {!selectedUser ? (
            <div className="bg-white rounded-xl border border-gray-200 flex items-center justify-center h-64 text-gray-400 text-sm">
              Select an employee to view/set salary
            </div>
          ) : loadingSalary ? (
            <div className="bg-white rounded-xl border border-gray-200 flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold">
                    {selectedUser.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{selectedUser.name}</p>
                    <p className="text-xs text-gray-500">{selectedUser.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Gross Salary (₹/month) *</label>
                    <input type="number" value={grossInput} onChange={e => setGrossInput(e.target.value)}
                      placeholder="e.g. 50000"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Monthly TDS (₹)</label>
                    <input type="number" value={tdsInput} onChange={e => setTdsInput(e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
                  </div>
                </div>
                <button onClick={saveSalary} disabled={saving || !grossInput}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-60">
                  {saving ? 'Saving...' : salary ? 'Update Salary' : 'Set Salary'}
                </button>
              </div>

              {preview && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <p className="text-sm font-semibold text-gray-700 mb-4">Salary Breakdown (Auto-calculated)</p>
                  <div className="space-y-1">
                    <SalarySection title="Earnings" rows={rows.filter(r => r.type === 'earning')} />
                    <div className="pt-2 pb-1 flex justify-between text-sm font-bold text-gray-800 border-t border-gray-200">
                      <span>Gross Salary</span><span>{formatINR(preview.grossSalary)}</span>
                    </div>
                    <SalarySection title="Deductions" rows={rows.filter(r => r.type === 'deduction')} color="text-red-600" />
                    <div className="pt-2 pb-1 flex justify-between text-sm font-bold text-green-700 border-t border-gray-200 bg-green-50 px-2 rounded">
                      <span>Net Salary (Take-Home)</span><span>{formatINR(preview.netSalary)}</span>
                    </div>
                    <SalarySection title="Employer Contributions (CTC add-ons)" rows={rows.filter(r => r.type === 'ctc')} color="text-blue-600" />
                    <div className="pt-2 flex justify-between text-sm font-bold text-blue-700 border-t border-blue-200 bg-blue-50 px-2 rounded">
                      <span>Total CTC (Annual: {formatINR(preview.totalCTC * 12)})</span>
                      <span>{formatINR(preview.totalCTC)}/mo</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SalarySection({ title, rows, color = 'text-gray-700' }: {
  title: string; rows: Array<{ label: string; value: number }>; color?: string
}) {
  return (
    <div className="pt-3">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{title}</p>
      {rows.map(r => (
        <div key={r.label} className="flex justify-between py-1.5 text-sm border-b border-gray-50">
          <span className="text-gray-600">{r.label}</span>
          <span className={cn('font-medium', color)}>{formatINR(r.value)}</span>
        </div>
      ))}
    </div>
  )
}
