'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { formatDate, getRoleLabel } from '@/lib/utils'
import toast from 'react-hot-toast'

interface ReportingManager { id: string; name: string; role: string; reportingManager?: { id: string; name: string; role: string; reportingManager?: { id: string; name: string; role: string } } }

interface Profile {
  id: string; name: string; email: string; phone: string | null; role: string; createdAt: string
  reportingManager: ReportingManager | null
  employeeProfile: {
    dateOfBirth: string | null; dateOfJoining: string | null; marriageAnniversary: string | null
    designation: string | null; department: string | null; probationEndDate: string | null; exitDate: string | null
  } | null
}

function toInputDate(val: string | null | undefined) {
  if (!val) return ''
  return new Date(val).toISOString().split('T')[0]
}

export default function MyProfilePage() {
  const { data: session } = useSession()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '', phone: '', designation: '', department: '',
    dateOfBirth: '', dateOfJoining: '', marriageAnniversary: '',
    probationEndDate: '', exitDate: '',
  })

  useEffect(() => {
    if (!session?.user?.id) return
    fetch(`/api/hr/profile/${session.user.id}`)
      .then(r => r.json())
      .then(d => {
        setProfile(d.data)
        const p = d.data
        setForm({
          name: p.name ?? '',
          phone: p.phone ?? '',
          designation: p.employeeProfile?.designation ?? '',
          department: p.employeeProfile?.department ?? '',
          dateOfBirth: toInputDate(p.employeeProfile?.dateOfBirth),
          dateOfJoining: toInputDate(p.employeeProfile?.dateOfJoining),
          marriageAnniversary: toInputDate(p.employeeProfile?.marriageAnniversary),
          probationEndDate: toInputDate(p.employeeProfile?.probationEndDate),
          exitDate: toInputDate(p.employeeProfile?.exitDate),
        })
      })
  }, [session?.user?.id])

  async function save() {
    if (!session?.user?.id) return
    setSaving(true)
    try {
      const res = await fetch(`/api/hr/profile/${session.user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed to save')
      const d = await res.json()
      setProfile(d.data)
      setEditing(false)
      toast.success('Profile updated')
    } catch {
      toast.error('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  if (!profile) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>

  const ep = profile.employeeProfile

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
          <p className="text-sm text-gray-500">View and update your personal information</p>
        </div>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700">
            Edit Profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button onClick={() => setEditing(false)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Avatar + basic */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-5 mb-6">
          <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold text-2xl">
            {profile.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-bold text-gray-900">{profile.name}</p>
            <p className="text-sm text-gray-500">{profile.email}</p>
            <span className="text-xs px-2 py-0.5 bg-brand-100 text-brand-700 rounded-full font-medium">{getRoleLabel(profile.role)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Full Name" editing={editing} value={form.name} displayValue={profile.name}
            onChange={v => setForm(f => ({ ...f, name: v }))} />
          <Field label="Mobile Number" editing={editing} value={form.phone} displayValue={profile.phone ?? '—'}
            onChange={v => setForm(f => ({ ...f, phone: v }))} />
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Official Email</p>
            <p className="text-sm text-gray-800">{profile.email}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Member Since</p>
            <p className="text-sm text-gray-800">{formatDate(profile.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* HR Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">HR Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Designation" editing={editing} value={form.designation} displayValue={ep?.designation ?? '—'}
            onChange={v => setForm(f => ({ ...f, designation: v }))} />
          <Field label="Department" editing={editing} value={form.department} displayValue={ep?.department ?? '—'}
            onChange={v => setForm(f => ({ ...f, department: v }))} />
          <DateField label="Date of Joining" editing={editing} value={form.dateOfJoining}
            displayValue={ep?.dateOfJoining ? formatDate(ep.dateOfJoining) : '—'}
            onChange={v => setForm(f => ({ ...f, dateOfJoining: v }))} />
          <DateField label="Date of Birth" editing={editing} value={form.dateOfBirth}
            displayValue={ep?.dateOfBirth ? formatDate(ep.dateOfBirth) : '—'}
            onChange={v => setForm(f => ({ ...f, dateOfBirth: v }))} />
          <DateField label="Marriage Anniversary" editing={editing} value={form.marriageAnniversary}
            displayValue={ep?.marriageAnniversary ? formatDate(ep.marriageAnniversary) : '—'}
            onChange={v => setForm(f => ({ ...f, marriageAnniversary: v }))} />
          <DateField label="Probation End Date" editing={editing} value={form.probationEndDate}
            displayValue={ep?.probationEndDate ? formatDate(ep.probationEndDate) : '—'}
            onChange={v => setForm(f => ({ ...f, probationEndDate: v }))} />
        </div>
      </div>

      {/* Reporting Chain */}
      {profile.reportingManager && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Reporting Structure</h2>
          <ReportingChain profile={profile} />
        </div>
      )}

      {/* Leave Balance */}
      <LeaveBalance userId={profile.id} />
    </div>
  )
}

function Field({ label, editing, value, displayValue, onChange }: {
  label: string; editing: boolean; value: string; displayValue: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      {editing ? (
        <input value={value} onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
      ) : (
        <p className="text-sm text-gray-800">{displayValue}</p>
      )}
    </div>
  )
}

function DateField({ label, editing, value, displayValue, onChange }: {
  label: string; editing: boolean; value: string; displayValue: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      {editing ? (
        <input type="date" value={value} onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
      ) : (
        <p className="text-sm text-gray-800">{displayValue}</p>
      )}
    </div>
  )
}

function LeaveBalance({ userId }: { userId: string }) {
  const [balance, setBalance] = useState<{ pl: number; cl: number; medical: number } | null>(null)

  useEffect(() => {
    const year = new Date().getFullYear()
    fetch(`/api/hr/attendance?userId=${userId}&month=all`)
      .then(() => {
        // Calculate from current year attendance
        const currentYear = new Date().getFullYear()
        fetch(`/api/hr/attendance?userId=${userId}`)
          .then(r => r.json())
          .then(d => {
            const records = (d.data ?? []).filter((a: { date: string; attendanceType: string; leaveType: string | null }) => {
              return new Date(a.date).getFullYear() === currentYear && a.attendanceType === 'LEAVE'
            })
            const pl = records.filter((a: { leaveType: string | null }) => a.leaveType === 'PL').length
            const cl = records.filter((a: { leaveType: string | null }) => a.leaveType === 'CL').length
            const medical = records.filter((a: { leaveType: string | null }) => a.leaveType === 'MEDICAL').length
            setBalance({ pl: Math.max(0, 12 - pl), cl: Math.max(0, 6 - cl), medical: Math.max(0, 6 - medical) })
          })
      })
      .catch(() => setBalance({ pl: 12, cl: 6, medical: 6 }))
    void year
  }, [userId])

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Leave Balance ({new Date().getFullYear()})</h2>
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Paid Leave', key: 'pl', total: 12, color: 'green' },
          { label: 'Casual Leave', key: 'cl', total: 6, color: 'blue' },
          { label: 'Medical Leave', key: 'medical', total: 6, color: 'purple' },
        ].map(({ label, key, total, color }) => {
          const remaining = balance ? balance[key as keyof typeof balance] : total
          const used = total - remaining
          const pct = (remaining / total) * 100
          return (
            <div key={key} className={`bg-${color}-50 border border-${color}-200 rounded-xl p-4 text-center`}>
              <p className={`text-2xl font-bold text-${color}-700`}>{balance ? remaining : '—'}</p>
              <p className={`text-xs font-medium text-${color}-600 mt-0.5`}>{label}</p>
              <p className="text-xs text-gray-500 mt-1">{used}/{total} used</p>
              <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full bg-${color}-500 rounded-full`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ReportingChain({ profile }: { profile: Profile }) {
  interface ChainNode { name: string; designation: string | null; role: string }
  const chain: ChainNode[] = []

  // Self
  chain.push({
    name: profile.name,
    designation: profile.employeeProfile?.designation ?? null,
    role: profile.role,
  })

  // Walk up reporting chain
  let current: ReportingManager | null | undefined = profile.reportingManager
  while (current) {
    chain.push({ name: current.name, designation: null, role: current.role })
    current = current.reportingManager
  }

  return (
    <div className="flex items-start flex-wrap gap-2">
      {chain.map((node, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
            <div className="w-7 h-7 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 text-xs font-bold flex-shrink-0">
              {node.name.charAt(0)}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-800 leading-none">{node.name}</p>
              <p className="text-[10px] text-gray-500 leading-none mt-0.5">
                {node.designation ?? getRoleLabel(node.role)}
              </p>
            </div>
          </div>
          {i < chain.length - 1 && (
            <span className="text-gray-300 font-bold">→</span>
          )}
        </div>
      ))}
    </div>
  )
}
