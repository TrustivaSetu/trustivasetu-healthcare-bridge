'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTabSession } from '@/contexts/TabSessionContext'
import { cn, formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import { format, addDays } from 'date-fns'
import { getTravelRatePerKm, getMonthlyTravelCap, EXPENSE_CATEGORIES, getCategoryLabel } from '@/lib/hr/expenses'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ExpenseItem {
  id?: string
  date: string
  category: string
  description: string
  fromLocation: string
  toLocation: string
  distanceKm: number | null
  amount: number
  billUrl: string | null
  billName: string | null
  clientName: string | null
}

interface Expense {
  id: string
  title: string
  periodType: string
  periodStart: string
  periodEnd: string
  status: string
  totalAmount: number
  approvedAmount: number | null
  rejectionReason: string | null
  submittedAt: string | null
  createdAt: string
  updatedAt: string
  notes: string | null
  items: ExpenseItem[]
  user: { id: string; name: string; employeeProfile: { designation: string | null } | null }
  approvedBy: { name: string } | null
}

const STATUS_STYLE: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  PARTIALLY_APPROVED: 'bg-teal-100 text-teal-700',
  REJECTED: 'bg-red-100 text-red-700',
}

function formatINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

const today = format(new Date(), 'yyyy-MM-dd')
const firstOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd')

function blankItem(): ExpenseItem {
  return { date: today, category: 'TRAVEL_KM', description: '', fromLocation: '', toLocation: '', distanceKm: null, amount: 0, billUrl: null, billName: null, clientName: null }
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const { user: session } = useTabSession()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editExpense, setEditExpense] = useState<Expense | null>(null)
  const [viewExpense, setViewExpense] = useState<Expense | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [designation, setDesignation] = useState<string | null>(null)

  const isAdmin = session?.role === 'SUPER_ADMIN' || session?.role === 'ADMIN'
  const travelRate = getTravelRatePerKm(designation)
  const monthlyCap = getMonthlyTravelCap(designation)

  useEffect(() => {
    if (session?.id) {
      fetch(`/api/hr/profile/${session?.id}`)
        .then(r => r.json())
        .then(d => setDesignation(d.data?.employeeProfile?.designation ?? null))
    }
  }, [session?.id])

  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (filterStatus) p.set('status', filterStatus)
    if (isAdmin) p.set('all', '1')
    const res = await fetch(`/api/expenses?${p}`)
    const d = await res.json()
    setExpenses(d.data ?? [])
    setLoading(false)
  }, [filterStatus, isAdmin])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  async function downloadExcel(expenseId?: string) {
    const p = new URLSearchParams()
    if (expenseId) p.set('expenseId', expenseId)
    const res = await fetch(`/api/expenses/export?${p}`)
    if (!res.ok) { toast.error('Export failed'); return }
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = expenseId ? `Expense_${expenseId.slice(-6)}.xlsx` : 'Expenses.xlsx'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function submitExpense(id: string) {
    const res = await fetch(`/api/expenses/${id}/submit`, { method: 'POST' })
    if (res.ok) { toast.success('Expense submitted for approval!'); fetchExpenses(); setViewExpense(null) }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed to submit') }
  }

  async function approveExpense(id: string, action: string, reason?: string, approvedAmount?: number) {
    const res = await fetch(`/api/expenses/${id}/approve`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason, approvedAmount }),
    })
    if (res.ok) { toast.success('Done!'); fetchExpenses(); setViewExpense(null) }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
  }

  async function deleteExpense(id: string) {
    if (!confirm('Delete this draft expense?')) return
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Deleted'); fetchExpenses() }
    else toast.error('Failed to delete')
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Expense Management</h1>
          <p className="text-sm text-gray-500">
            Your travel rate: <strong>{formatINR(travelRate)}/km</strong> &nbsp;·&nbsp;
            Monthly cap: <strong>{formatINR(monthlyCap)}</strong>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isAdmin && (
            <button onClick={() => downloadExcel()} className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Export All
            </button>
          )}
          <button onClick={() => { setEditExpense(null); setShowForm(true) }}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Expense
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['', 'DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={cn('px-3 py-1.5 text-xs font-medium rounded-full border transition',
              filterStatus === s ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 text-gray-600 hover:border-brand-300')}>
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Expense list */}
      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      ) : expenses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <p className="text-3xl mb-3">🧾</p>
          <p className="text-gray-500 text-sm">No expenses found. Create your first expense report.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {expenses.map(exp => (
            <div key={exp.id} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900 text-sm">{exp.title}</p>
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', STATUS_STYLE[exp.status])}>{exp.status.replace('_', ' ')}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDate(exp.periodStart)} → {formatDate(exp.periodEnd)} &nbsp;·&nbsp; {exp.items.length} item{exp.items.length !== 1 ? 's' : ''}
                    {isAdmin && ` · ${exp.user.name}`}
                  </p>
                  {exp.rejectionReason && (
                    <p className="text-xs text-red-600 mt-1 bg-red-50 px-2 py-1 rounded">Rejected: {exp.rejectionReason}</p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-lg font-bold text-gray-900">{formatINR(exp.totalAmount)}</p>
                  {exp.approvedAmount !== null && exp.approvedAmount !== exp.totalAmount && (
                    <p className="text-xs text-teal-600">Approved: {formatINR(exp.approvedAmount)}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-3 flex-wrap">
                <button onClick={() => setViewExpense(exp)} className="text-xs text-brand-600 hover:text-brand-800 font-medium">View</button>
                {(exp.status === 'DRAFT' || exp.status === 'REJECTED') && exp.user.id === session?.id && (
                  <>
                    <button onClick={() => { setEditExpense(exp); setShowForm(true) }} className="text-xs text-gray-600 hover:text-gray-800 font-medium">Edit</button>
                    {exp.status === 'DRAFT' && <button onClick={() => deleteExpense(exp.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">Delete</button>}
                    <button onClick={() => submitExpense(exp.id)} className="text-xs text-green-600 hover:text-green-800 font-semibold">Submit →</button>
                  </>
                )}
                {exp.status === 'SUBMITTED' && (isAdmin || exp.user.id !== session?.id) && (
                  <ApproveButtons onApprove={(a, r, amt) => approveExpense(exp.id, a, r, amt)} totalAmount={exp.totalAmount} />
                )}
                <button onClick={() => downloadExcel(exp.id)} className="text-xs text-gray-500 hover:text-gray-700 font-medium">↓ Excel</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <ExpenseFormModal
          initial={editExpense}
          designation={designation}
          travelRate={travelRate}
          onClose={() => setShowForm(false)}
          onSuccess={() => { setShowForm(false); fetchExpenses() }}
        />
      )}

      {/* View Expense Modal */}
      {viewExpense && (
        <ExpenseViewModal
          expense={viewExpense}
          isAdmin={isAdmin}
          currentUserId={session?.id ?? ''}
          onClose={() => setViewExpense(null)}
          onSubmit={() => submitExpense(viewExpense.id)}
          onApprove={(a, r, amt) => approveExpense(viewExpense.id, a, r, amt)}
          onDownload={() => downloadExcel(viewExpense.id)}
        />
      )}
    </div>
  )
}

// ── Approve Buttons inline ─────────────────────────────────────────────────────

function ApproveButtons({ onApprove, totalAmount }: {
  onApprove: (action: string, reason?: string, amount?: number) => void
  totalAmount: number
}) {
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  if (showReject) return (
    <div className="flex items-center gap-1.5">
      <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Rejection reason..." className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-red-400 w-36" />
      <button onClick={() => { onApprove('reject', reason); setShowReject(false) }} className="text-xs text-red-600 font-semibold hover:text-red-800">Confirm Reject</button>
      <button onClick={() => setShowReject(false)} className="text-xs text-gray-400">Cancel</button>
    </div>
  )
  return (
    <>
      <button onClick={() => onApprove('approve')} className="text-xs text-green-600 hover:text-green-800 font-semibold">✓ Approve</button>
      <button onClick={() => setShowReject(true)} className="text-xs text-red-500 hover:text-red-700 font-semibold">✗ Reject</button>
    </>
  )
}

// ── Expense Form Modal ─────────────────────────────────────────────────────────

function ExpenseFormModal({ initial, designation, travelRate, onClose, onSuccess }: {
  initial: Expense | null
  designation: string | null
  travelRate: number
  onClose: () => void
  onSuccess: () => void
}) {
  const isEdit = !!initial?.id
  const [title, setTitle] = useState(initial?.title ?? `Expenses ${format(new Date(), 'MMMM yyyy')}`)
  const [periodStart, setPeriodStart] = useState(initial?.periodStart?.split('T')[0] ?? firstOfMonth)
  const [periodEnd, setPeriodEnd] = useState(initial?.periodEnd?.split('T')[0] ?? today)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [items, setItems] = useState<ExpenseItem[]>(initial?.items?.length ? initial.items.map(i => ({ ...i, date: i.date.split('T')[0] })) : [blankItem()])
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<number | null>(null)

  function updateItem(idx: number, key: keyof ExpenseItem, val: unknown) {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [key]: val }
      // Auto-calculate travel km amount
      if ((key === 'distanceKm' || key === 'category') && updated.category === 'TRAVEL_KM') {
        updated.amount = Math.round((updated.distanceKm ?? 0) * travelRate)
      }
      return updated
    }))
  }

  async function uploadBill(idx: number, file: File) {
    setUploading(idx)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('folder', 'expense-bills')
    const res = await fetch('/api/upload', { method: 'POST', body: fd })
    const d = await res.json()
    if (d.url) { updateItem(idx, 'billUrl', d.url); updateItem(idx, 'billName', file.name); toast.success('Bill uploaded') }
    else toast.error('Upload failed')
    setUploading(null)
  }

  async function save() {
    if (!title.trim()) { toast.error('Enter a title'); return }
    if (items.some(i => !i.description.trim())) { toast.error('All items need a description'); return }
    setSaving(true)
    const payload = { title, periodType: 'MONTHLY', periodStart, periodEnd, notes: notes || null, items }
    const url = isEdit ? `/api/expenses/${initial!.id}` : '/api/expenses'
    const method = isEdit ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (res.ok) { toast.success(isEdit ? 'Expense updated' : 'Expense saved as draft'); onSuccess() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed') }
    setSaving(false)
  }

  const total = items.reduce((s, i) => s + (i.amount || 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white flex justify-between items-center px-5 py-4 border-b border-gray-100 z-10">
          <div>
            <h2 className="font-bold text-gray-900">{isEdit ? 'Edit Expense' : 'New Expense Report'}</h2>
            <p className="text-xs text-gray-400">Save as draft anytime. Submit when ready.</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 text-xl">✕</button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Report Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Period From</label>
              <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Period To</label>
              <input type="date" value={periodEnd} min={periodStart} onChange={e => setPeriodEnd(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
          </div>

          {/* Expense items */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Expense Items</label>
              <button type="button" onClick={() => setItems(prev => [...prev, blankItem()])}
                className="text-xs text-brand-600 hover:text-brand-800 font-semibold">+ Add Item</button>
            </div>
            <div className="space-y-3">
              {items.map((item, idx) => {
                const catDef = EXPENSE_CATEGORIES.find(c => c.value === item.category)
                return (
                  <div key={idx} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-xs font-semibold text-gray-500">Item {idx + 1}</span>
                      {items.length > 1 && (
                        <button type="button" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 mb-1">Date</label>
                        <input type="date" value={item.date} onChange={e => updateItem(idx, 'date', e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-400" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-semibold text-gray-500 mb-1">Category</label>
                        <select value={item.category} onChange={e => updateItem(idx, 'category', e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-400">
                          {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 mb-1">Amount (₹)</label>
                        <input type="number" value={item.amount || ''} readOnly={item.category === 'TRAVEL_KM'} onChange={e => updateItem(idx, 'amount', parseFloat(e.target.value) || 0)}
                          className={cn('w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-400', item.category === 'TRAVEL_KM' && 'bg-gray-100 cursor-not-allowed')} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">Description *</label>
                      <input value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="Brief description..." className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-brand-400" />
                    </div>
                    {item.category === 'TRAVEL_KM' && (
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 mb-1">From</label>
                          <input value={item.fromLocation ?? ''} onChange={e => updateItem(idx, 'fromLocation', e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 mb-1">To</label>
                          <input value={item.toLocation ?? ''} onChange={e => updateItem(idx, 'toLocation', e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-gray-500 mb-1">Distance (km)</label>
                          <input type="number" value={item.distanceKm ?? ''} onChange={e => updateItem(idx, 'distanceKm', parseFloat(e.target.value) || null)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none" />
                        </div>
                        {item.distanceKm && <p className="col-span-3 text-[10px] text-brand-600 font-medium">{item.distanceKm} km × ₹{travelRate}/km = {formatINR(item.amount)}</p>}
                      </div>
                    )}
                    {catDef?.hasClient && (
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-500 mb-1">Client Name</label>
                        <input value={item.clientName ?? ''} onChange={e => updateItem(idx, 'clientName', e.target.value)} className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none" />
                      </div>
                    )}
                    {catDef?.hasBill && (
                      <div className="flex items-center gap-2">
                        {item.billUrl ? (
                          <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                            {item.billName ?? 'Bill attached'}
                            <button type="button" onClick={() => { updateItem(idx, 'billUrl', null); updateItem(idx, 'billName', null) }} className="text-red-400 hover:text-red-600 ml-1">✕</button>
                          </div>
                        ) : (
                          <label className="cursor-pointer text-xs text-gray-500 hover:text-brand-600 border border-dashed border-gray-300 hover:border-brand-400 rounded-lg px-3 py-1.5 transition flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                            {uploading === idx ? 'Uploading...' : 'Attach Bill'}
                            <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf" disabled={uploading !== null} onChange={e => { if (e.target.files?.[0]) uploadBill(idx, e.target.files[0]) }} />
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none" />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-xl font-bold text-gray-900">{formatINR(total)}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50">Cancel</button>
            <button onClick={save} disabled={saving} className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold rounded-xl disabled:opacity-60">
              {saving ? 'Saving...' : isEdit ? 'Update Draft' : 'Save as Draft'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Expense View Modal ─────────────────────────────────────────────────────────

function ExpenseViewModal({ expense, isAdmin, currentUserId, onClose, onSubmit, onApprove, onDownload }: {
  expense: Expense; isAdmin: boolean; currentUserId: string
  onClose: () => void; onSubmit: () => void
  onApprove: (action: string, reason?: string, amount?: number) => void
  onDownload: () => void
}) {
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  const isSelf = expense.user.id === currentUserId
  const canSubmit = isSelf && (expense.status === 'DRAFT' || expense.status === 'REJECTED')
  const canApprove = (isAdmin || !isSelf) && expense.status === 'SUBMITTED'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-bold text-gray-900">{expense.title}</h2>
            <p className="text-xs text-gray-400">{formatDate(expense.periodStart)} → {formatDate(expense.periodEnd)} · {expense.user.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('px-2 py-1 rounded-full text-xs font-bold', STATUS_STYLE[expense.status])}>{expense.status.replace('_', ' ')}</span>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 text-xl">✕</button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          {expense.rejectionReason && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              <strong>Rejected:</strong> {expense.rejectionReason}
            </div>
          )}

          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Date</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Category</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Description</th>
              <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">Amount</th>
              <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">Bill</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {expense.items.map((item, i) => (
                <tr key={i}>
                  <td className="px-3 py-2 text-xs text-gray-600">{format(new Date(item.date), 'dd MMM')}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{getCategoryLabel(item.category)}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{item.description}{item.distanceKm ? ` (${item.distanceKm} km)` : ''}</td>
                  <td className="px-3 py-2 text-xs font-semibold text-gray-900 text-right">{formatINR(item.amount)}</td>
                  <td className="px-3 py-2 text-center">
                    {item.billUrl ? (
                      <a href={item.billUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline">View</a>
                    ) : <span className="text-xs text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="bg-gray-50">
              <td colSpan={3} className="px-3 py-2 text-sm font-bold text-gray-700">Total</td>
              <td className="px-3 py-2 text-sm font-bold text-gray-900 text-right">{formatINR(expense.totalAmount)}</td>
              <td />
            </tr></tfoot>
          </table>
          {expense.notes && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3"><strong>Notes:</strong> {expense.notes}</p>}
        </div>

        <div className="border-t border-gray-100 px-5 py-4 flex items-center justify-between flex-wrap gap-2">
          <button onClick={onDownload} className="text-xs text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1">↓ Download Excel</button>
          <div className="flex gap-2">
            {canSubmit && <button onClick={onSubmit} className="px-4 py-2 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700">Submit for Approval →</button>}
            {canApprove && !showReject && (
              <>
                <button onClick={() => onApprove('approve')} className="px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700">✓ Approve</button>
                <button onClick={() => setShowReject(true)} className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 text-sm font-bold rounded-xl hover:bg-red-100">✗ Reject</button>
              </>
            )}
            {showReject && (
              <div className="flex items-center gap-2">
                <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason..." className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400 w-44" />
                <button onClick={() => { onApprove('reject', rejectReason); setShowReject(false) }} className="px-3 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700">Reject</button>
                <button onClick={() => setShowReject(false)} className="text-xs text-gray-400">Cancel</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
