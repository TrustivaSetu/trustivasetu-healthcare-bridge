'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import { useTabSession } from '@/contexts/TabSessionContext'
import {
  STANDARD_SCHEMES, calculateIRR, irrHealth, fmtINR, type Scheme,
} from '@/lib/irr'

type TabKey = 'calculator' | 'schemes' | 'hospital' | 'npa' | 'benchmark'

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'calculator', label: 'IRR Calculator', icon: '🧮' },
  { key: 'schemes', label: 'Scheme Manager', icon: '📋' },
  { key: 'hospital', label: 'Hospital Revenue', icon: '🏥' },
  { key: 'npa', label: 'NPA Tracker', icon: '⚠️' },
  { key: 'benchmark', label: 'Lender Benchmarking', icon: '📊' },
]

export default function RevenueIntelligencePage() {
  const { user } = useTabSession()
  const [tab, setTab] = useState<TabKey>('calculator')
  const isAdmin = user?.role === 'SUPER_ADMIN' || user?.role === 'ADMIN'

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-trustiva-navy flex items-center gap-2">
          <span>💹</span> Revenue Intelligence
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          IRR analytics, scheme economics, hospital revenue and portfolio asset-quality — in one place.
        </p>
      </header>

      <div className="flex gap-1 border-b border-gray-200 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-trustiva-lime text-trustiva-navy'
                : 'border-transparent text-gray-500 hover:text-trustiva-navy'
            }`}
          >
            <span className="mr-1.5">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {tab === 'calculator' && <CalculatorTab />}
      {tab === 'schemes' && <SchemesTab />}
      {tab === 'hospital' && <HospitalTab />}
      {tab === 'npa' && <NpaTab />}
      {tab === 'benchmark' && <BenchmarkTab isAdmin={isAdmin} />}
    </div>
  )
}

/* ---------------------------------------------------------------- Calculator */

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-xl border border-gray-200 shadow-sm ${className}`}>{children}</div>
}

function NumField({ label, value, onChange, suffix, step = 1, min = 0 }: {
  label: string; value: number; onChange: (n: number) => void; suffix?: string; step?: number; min?: number
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <div className="mt-1 relative">
        <input
          type="number" value={value} step={step} min={min}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-trustiva-lime focus:ring-1 focus:ring-trustiva-lime outline-none"
        />
        {suffix && <span className="absolute right-3 top-2.5 text-xs text-gray-400">{suffix}</span>}
      </div>
    </label>
  )
}

function CalculatorTab() {
  const [scheme, setScheme] = useState<Scheme>({
    name: 'Custom', subventionPct: 13, processingFeePct: 1, tenure: 12, advanceEMI: 0,
  })
  const result = useMemo(() => calculateIRR(scheme), [scheme])
  const health = irrHealth(result.netIRR)

  const set = (patch: Partial<Scheme>) => setScheme(s => ({ ...s, ...patch, name: 'Custom' }))

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-trustiva-navy mb-4">Scheme Inputs</h2>
        <div className="grid grid-cols-2 gap-4">
          <NumField label="Subvention" value={scheme.subventionPct} suffix="%" onChange={v => set({ subventionPct: v })} step={0.5} />
          <NumField label="Processing Fee" value={scheme.processingFeePct} suffix="%" onChange={v => set({ processingFeePct: v })} step={0.5} />
          <NumField label="Tenure" value={scheme.tenure} suffix="mo" onChange={v => set({ tenure: Math.max(1, Math.round(v)) })} min={1} />
          <NumField label="Advance EMI" value={scheme.advanceEMI} suffix="EMIs" onChange={v => set({ advanceEMI: Math.max(0, Math.round(v)) })} />
        </div>

        <p className="text-xs text-gray-400 mt-4">Quick presets</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {STANDARD_SCHEMES.map(s => (
            <button key={s.name} onClick={() => setScheme(s)}
              className="px-2.5 py-1 text-xs rounded-full border border-gray-200 hover:border-trustiva-lime hover:bg-lime-50 transition-colors">
              {s.name}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-trustiva-navy mb-4">Lender Yield (per ₹100 gross loan)</h2>
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="rounded-lg bg-slate-50 p-4">
            <p className="text-xs text-gray-500">Gross IRR (APR)</p>
            <p className="text-2xl font-bold text-trustiva-navy mt-1">{isFinite(result.grossIRR) ? result.grossIRR.toFixed(2) : '—'}%</p>
          </div>
          <div className="rounded-lg p-4" style={{ background: `${health.color}15` }}>
            <p className="text-xs text-gray-500">Net IRR (APR)</p>
            <p className="text-2xl font-bold mt-1" style={{ color: health.color }}>{isFinite(result.netIRR) ? result.netIRR.toFixed(2) : '—'}%</p>
            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded mt-1 inline-block" style={{ background: health.color, color: '#fff' }}>{health.label}</span>
          </div>
        </div>
        <dl className="text-sm divide-y divide-gray-100">
          {[
            ['Financed balance (EMIs)', `${result.balance}`],
            ['EMI (per ₹100)', fmtINR(result.emi, 2)],
            ['Merchant discount excl. GST', fmtINR(result.dbdNet, 2)],
            ['Merchant discount incl. GST', fmtINR(result.dbdGross, 2)],
            ['Net amount disbursed', fmtINR(result.netDisbursed, 2)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between py-2">
              <dt className="text-gray-500">{k}</dt><dd className="font-medium text-trustiva-navy">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  )
}

/* ------------------------------------------------------------------- Schemes */

function SchemesTab() {
  const rows = STANDARD_SCHEMES.map(s => ({ s, r: calculateIRR(s) }))
  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-gray-500 text-xs uppercase">
          <tr>
            {['Scheme', 'Tenure', 'Subvention', 'Proc. Fee', 'Adv. EMI', 'Net Disbursed', 'Gross IRR', 'Net IRR', 'Rating'].map(h => (
              <th key={h} className="text-left font-medium px-4 py-3">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map(({ s, r }) => {
            const h = irrHealth(r.netIRR)
            return (
              <tr key={s.name} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 font-medium text-trustiva-navy">{s.name}</td>
                <td className="px-4 py-3">{s.tenure} mo</td>
                <td className="px-4 py-3">{s.subventionPct}%</td>
                <td className="px-4 py-3">{s.processingFeePct}%</td>
                <td className="px-4 py-3">{s.advanceEMI}</td>
                <td className="px-4 py-3">{fmtINR(r.netDisbursed, 2)}</td>
                <td className="px-4 py-3 font-medium">{r.grossIRR.toFixed(2)}%</td>
                <td className="px-4 py-3 font-semibold" style={{ color: h.color }}>{r.netIRR.toFixed(2)}%</td>
                <td className="px-4 py-3">
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded" style={{ background: `${h.color}20`, color: h.color }}>{h.label}</span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </Card>
  )
}

/* --------------------------------------------------------------- data hooks */

function useApi<T>(url: string) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const reload = useCallback(() => {
    setLoading(true)
    fetch(url)
      .then(async r => { if (!r.ok) throw new Error((await r.json()).error || 'Request failed'); return r.json() })
      .then(d => { setData(d); setError(null) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [url])
  useEffect(() => { reload() }, [reload])
  return { data, loading, error, reload }
}

function StateBox({ loading, error, empty, children }: { loading: boolean; error: string | null; empty?: boolean; children: React.ReactNode }) {
  if (loading) return <div className="flex justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-4 border-trustiva-lime border-t-transparent" /></div>
  if (error) return <Card className="p-8 text-center text-sm text-red-600">{error}</Card>
  if (empty) return <Card className="p-12 text-center text-sm text-gray-400">No data yet.</Card>
  return <>{children}</>
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-bold mt-1" style={{ color: accent || '#0F172A' }}>{value}</p>
    </Card>
  )
}

/* ------------------------------------------------------------------ Hospital */

interface HospitalRow { clinicId: string; clinicName: string; disbursedAmount: number; leadCount: number; estimatedRevenue: number; effectiveRatePct: number }
interface HospitalResp { data: HospitalRow[]; totals: { disbursedAmount: number; leadCount: number; estimatedRevenue: number; blendedRatePct: number; hospitalCount: number } }

function HospitalTab() {
  const { data, loading, error } = useApi<HospitalResp>('/api/revenue/hospital-revenue')
  return (
    <StateBox loading={loading} error={error} empty={!!data && data.data.length === 0}>
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Stat label="Hospitals" value={`${data.totals.hospitalCount}`} />
            <Stat label="Disbursed Volume" value={fmtINR(data.totals.disbursedAmount)} />
            <Stat label="Est. Revenue" value={fmtINR(data.totals.estimatedRevenue)} accent="#16a34a" />
            <Stat label="Blended Rate" value={`${data.totals.blendedRatePct}%`} />
          </div>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-gray-500 text-xs uppercase">
                <tr>{['Hospital', 'Disbursed Leads', 'Disbursed Volume', 'Eff. Rate', 'Est. Revenue'].map(h => <th key={h} className="text-left font-medium px-4 py-3">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.data.map(r => (
                  <tr key={r.clinicId} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-trustiva-navy">{r.clinicName}</td>
                    <td className="px-4 py-3">{r.leadCount}</td>
                    <td className="px-4 py-3">{fmtINR(r.disbursedAmount)}</td>
                    <td className="px-4 py-3">{r.effectiveRatePct}%</td>
                    <td className="px-4 py-3 font-semibold text-green-700">{fmtINR(r.estimatedRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </StateBox>
  )
}

/* ----------------------------------------------------------------------- NPA */

interface NpaBucket { key: string; label: string; color: string; count: number; amount: number }
interface NpaOverdue { id: string; leadNumber: number | null; applicantName: string; clinicName: string; disbursedAmount: number; ageDays: number; nachStatus: string | null }
interface NpaResp { data: NpaBucket[]; overdue: NpaOverdue[]; totals: { totalAmount: number; totalCount: number; overdueAmount: number; npaRatio: number } }

function NpaTab() {
  const { data, loading, error } = useApi<NpaResp>('/api/revenue/npa-tracker')
  return (
    <StateBox loading={loading} error={error} empty={!!data && data.totals.totalCount === 0}>
      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Stat label="Disbursed Loans" value={`${data.totals.totalCount}`} />
            <Stat label="Portfolio Value" value={fmtINR(data.totals.totalAmount)} />
            <Stat label="Overdue (90d+)" value={fmtINR(data.totals.overdueAmount)} accent="#dc2626" />
            <Stat label="NPA Ratio" value={`${data.totals.npaRatio}%`} accent={data.totals.npaRatio > 5 ? '#dc2626' : '#16a34a'} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {data.data.map(b => (
              <div key={b.key} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 border-l-4" style={{ borderLeftColor: b.color }}>
                <p className="text-xs font-medium" style={{ color: b.color }}>{b.label}</p>
                <p className="text-lg font-bold text-trustiva-navy mt-1">{b.count}</p>
                <p className="text-xs text-gray-500">{fmtINR(b.amount)}</p>
              </div>
            ))}
          </div>

          {data.overdue.length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-4 py-3 bg-red-50 text-red-700 text-xs font-semibold uppercase">Overdue Accounts (90d+)</div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-gray-500 text-xs uppercase">
                  <tr>{['Lead', 'Applicant', 'Hospital', 'Amount', 'Age', 'NACH'].map(h => <th key={h} className="text-left font-medium px-4 py-3">{h}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.overdue.map(o => (
                    <tr key={o.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-mono text-xs">{o.leadNumber ? `TS-${String(o.leadNumber).padStart(6, '0')}` : '—'}</td>
                      <td className="px-4 py-3">{o.applicantName}</td>
                      <td className="px-4 py-3">{o.clinicName}</td>
                      <td className="px-4 py-3">{fmtINR(o.disbursedAmount)}</td>
                      <td className="px-4 py-3 text-red-600 font-medium">{o.ageDays}d</td>
                      <td className="px-4 py-3 text-xs">{o.nachStatus || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}
    </StateBox>
  )
}

/* ------------------------------------------------------------- Benchmarking */

interface LenderRateRow { id: string; lenderId: string; agreedRatePct: number; effectiveFrom: string; effectiveTo: string | null; notes: string | null; lender: { id: string; name: string; code: string; isActive: boolean } }
interface Lender { id: string; name: string; code: string }

function BenchmarkTab({ isAdmin }: { isAdmin: boolean }) {
  const { data, loading, error, reload } = useApi<{ data: LenderRateRow[] }>('/api/revenue/lender-rates')
  const [lenders, setLenders] = useState<Lender[]>([])
  const [form, setForm] = useState({ lenderId: '', agreedRatePct: 4, notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/lenders?all=1').then(r => r.ok ? r.json() : { data: [] }).then(d => setLenders(d.data || [])).catch(() => {})
  }, [])

  const addRate = async () => {
    if (!form.lenderId) { toast.error('Select a lender'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/revenue/lender-rates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lenderId: form.lenderId, agreedRatePct: Number(form.agreedRatePct), notes: form.notes || undefined }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Failed')
      toast.success('Rate added')
      setForm({ lenderId: '', agreedRatePct: 4, notes: '' })
      reload()
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Failed') }
    finally { setSaving(false) }
  }

  const rates = data?.data || []
  const avg = rates.length ? rates.reduce((a, r) => a + r.agreedRatePct, 0) / rates.length : 0

  return (
    <div className="space-y-5">
      {rates.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Stat label="Lenders Rated" value={`${new Set(rates.map(r => r.lenderId)).size}`} />
          <Stat label="Average Rate" value={`${avg.toFixed(2)}%`} />
          <Stat label="Best Rate" value={`${Math.min(...rates.map(r => r.agreedRatePct)).toFixed(2)}%`} accent="#16a34a" />
        </div>
      )}

      {isAdmin && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-trustiva-navy mb-3">Add Lender Rate</h2>
          <div className="grid sm:grid-cols-4 gap-3 items-end">
            <label className="block sm:col-span-2">
              <span className="text-xs font-medium text-gray-600">Lender</span>
              <select value={form.lenderId} onChange={e => setForm(f => ({ ...f, lenderId: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-trustiva-lime">
                <option value="">Select lender…</option>
                {lenders.map(l => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
              </select>
            </label>
            <NumField label="Agreed Rate" value={form.agreedRatePct} suffix="%" step={0.25} onChange={v => setForm(f => ({ ...f, agreedRatePct: v }))} />
            <button onClick={addRate} disabled={saving}
              className="rounded-lg bg-trustiva-navy text-trustiva-lime font-semibold text-sm py-2.5 hover:opacity-90 disabled:opacity-50">
              {saving ? 'Saving…' : 'Add Rate'}
            </button>
          </div>
        </Card>
      )}

      <StateBox loading={loading} error={error} empty={rates.length === 0}>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-gray-500 text-xs uppercase">
              <tr>{['Lender', 'Code', 'Agreed Rate', 'Competitiveness', 'Effective From', 'Notes'].map(h => <th key={h} className="text-left font-medium px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rates.map(r => {
                // Lower rate = more competitive for the borrower → greener.
                const rank = avg ? (r.agreedRatePct <= avg ? '#16a34a' : '#d97706') : '#6b7280'
                return (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-trustiva-navy">{r.lender.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.lender.code}</td>
                    <td className="px-4 py-3 font-semibold">{r.agreedRatePct.toFixed(2)}%</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded" style={{ background: `${rank}20`, color: rank }}>
                        {avg && r.agreedRatePct <= avg ? 'Competitive' : 'Above Avg'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(r.effectiveFrom).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{r.notes || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      </StateBox>
    </div>
  )
}
