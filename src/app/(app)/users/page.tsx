'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTabSession } from '@/contexts/TabSessionContext'
import { formatDate, cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import { ChangePasswordModal } from '@/components/users/ChangePasswordModal'
import { ALL_DESIGNATIONS, DESIGNATION_LEVEL } from '@/lib/hr/designations'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ReportingManager {
  id: string; name: string; designation: string | null
}

interface User {
  id: string; email: string; name: string; role: string; isActive: boolean
  phone: string | null; createdAt: string; reportingManagerId: string | null
  designation: string | null
  reportingManager: ReportingManager | null
  regionAssignments: Array<{ region: { id: string; name: string } }>
  clinicAssignments: Array<{ clinic: { id: string; name: string } }>
}

interface MinimalUser {
  id: string; name: string; role: string; designation: string | null
}

interface HospitalUser {
  id: string
  email: string
  name: string
  isActive: boolean
  mustChangePassword: boolean
  createdAt: string
  lastLoginAt: string | null
  clinic: { id: string; name: string; email: string | null } | null
}

// ── Role display ──────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  REGIONAL_MANAGER: 'Manager',
  TEAM_MEMBER: 'Team Member',
}

const ROLE_COLOR: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-100 text-purple-800',
  ADMIN: 'bg-blue-100 text-blue-800',
  REGIONAL_MANAGER: 'bg-teal-100 text-teal-800',
  TEAM_MEMBER: 'bg-gray-100 text-gray-700',
}

function formatManagerLabel(u: MinimalUser) {
  return u.designation ? `${u.name} — ${u.designation}` : u.name
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { user: session } = useTabSession()
  const [mainTab, setMainTab] = useState<'staff' | 'hospital'>('staff')

  const isSuperAdmin = session?.role === 'SUPER_ADMIN'
  const isAdmin = session?.role === 'SUPER_ADMIN' || session?.role === 'ADMIN'

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-6 space-y-4">
        {/* Main tab switcher */}
        <div className="flex gap-2 border-b border-gray-200 pb-0">
          <button
            onClick={() => setMainTab('staff')}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              mainTab === 'staff'
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}
          >
            Staff Users
          </button>
          {isAdmin && (
            <button
              onClick={() => setMainTab('hospital')}
              className={cn(
                'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                mainTab === 'hospital'
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              Channel Partner Users
            </button>
          )}
        </div>

        {mainTab === 'staff' && (
          <StaffTab session={session} isSuperAdmin={isSuperAdmin} isAdmin={isAdmin} />
        )}
        {mainTab === 'hospital' && isAdmin && (
          <HospitalUsersTab isSuperAdmin={isSuperAdmin} />
        )}
      </div>
    </div>
  )
}

// ── Staff Tab ─────────────────────────────────────────────────────────────────

function StaffTab({ session, isSuperAdmin, isAdmin }: { session: { id: string; role: string } | null; isSuperAdmin: boolean; isAdmin: boolean }) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [search, setSearch] = useState('')
  const [changePasswordUser, setChangePasswordUser] = useState<User | null>(null)
  const [roleChangeUser, setRoleChangeUser] = useState<User | null>(null)
  const [newRole, setNewRole] = useState('')
  const [roleChanging, setRoleChanging] = useState(false)

  const canChangePasswords = isAdmin

  const PROTECTED_EMAIL = 'admin@trustivasetu.com'

  async function handleDeleteUser(user: User) {
    if (!confirm(`Are you sure you want to delete this user? This cannot be undone.`)) return
    const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' })
    if (res.ok) { toast.success(`${user.name} deleted`); fetchUsers() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed to delete user') }
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    // Exclude CLINIC_USER from staff list
    const res = await fetch(`/api/users?${p}`)
    const data = await res.json()
    setUsers((data.data ?? []).filter((u: User) => u.role !== 'CLINIC_USER'))
    setLoading(false)
  }, [search])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function toggleActive(user: User) {
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !user.isActive }),
    })
    if (res.ok) { toast.success('User updated'); fetchUsers() }
    else toast.error('Failed to update user')
  }

  async function changeRole() {
    if (!roleChangeUser || !newRole) return
    setRoleChanging(true)
    const res = await fetch(`/api/users/${roleChangeUser.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    if (res.ok) { toast.success('Role updated'); setRoleChangeUser(null); fetchUsers() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed to change role') }
    setRoleChanging(false)
  }

  return (
    <>
      {/* Search + Add */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 w-64"
        />
        <button
          onClick={() => { setEditUser(null); setShowForm(true) }}
          className="ml-auto px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </button>
      </div>

      {/* Add / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-y-auto max-h-[92vh]">
            <div className="sticky top-0 bg-white flex justify-between items-center px-6 py-4 border-b border-gray-100 rounded-t-2xl">
              <h2 className="text-base font-bold text-gray-800">{editUser ? 'Edit User' : 'Add New User'}</h2>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100">✕</button>
            </div>
            <div className="px-6 py-5">
              <UserForm
                initial={editUser}
                onSuccess={() => { setShowForm(false); fetchUsers() }}
                onCancel={() => setShowForm(false)}
                isSuperAdmin={isSuperAdmin}
                excludeId={editUser?.id}
              />
            </div>
          </div>
        </div>
      )}

      {/* Change password modal */}
      {changePasswordUser && (
        <ChangePasswordModal
          userId={changePasswordUser.id}
          userName={changePasswordUser.name}
          canChange={canChangePasswords}
          onClose={() => setChangePasswordUser(null)}
        />
      )}

      {/* Change role modal */}
      {roleChangeUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-semibold text-gray-800">Change System Role</h2>
              <button onClick={() => setRoleChangeUser(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              Changing role for <strong>{roleChangeUser.name}</strong>
            </p>
            <p className="text-xs text-gray-400 mb-4">
              Current: <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', ROLE_COLOR[roleChangeUser.role])}>{ROLE_LABEL[roleChangeUser.role]}</span>
            </p>
            <select value={newRole} onChange={e => setNewRole(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 mb-4">
              <option value="">— Select new role —</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="ADMIN">Admin</option>
              <option value="REGIONAL_MANAGER">Manager</option>
              <option value="TEAM_MEMBER">Team Member</option>
            </select>
            <div className="flex gap-3">
              <button onClick={changeRole} disabled={!newRole || roleChanging}
                className="flex-1 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-60">
                {roleChanging ? 'Saving...' : 'Confirm'}
              </button>
              <button onClick={() => setRoleChangeUser(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Name', 'Designation', 'User Role', 'Reporting To', 'Status', 'Joined', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-bold text-sm flex-shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{u.name}</p>
                          <p className="text-xs text-gray-400 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {u.designation ? (
                        <span className="text-sm text-gray-700 font-medium">{u.designation}</span>
                      ) : (
                        <span className="text-xs text-gray-300 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold', ROLE_COLOR[u.role] ?? 'bg-gray-100 text-gray-700')}>
                        {ROLE_LABEL[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {u.reportingManager ? (
                        <div>
                          <p className="text-sm text-gray-700 font-medium">{u.reportingManager.name}</p>
                          {u.reportingManager.designation && (
                            <p className="text-xs text-gray-400">{u.reportingManager.designation}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300 italic">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold', u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap">
                        <button onClick={() => { setEditUser(u); setShowForm(true) }} className="text-xs text-brand-600 hover:text-brand-800 font-medium">Edit</button>
                        <button onClick={() => setChangePasswordUser(u)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">Password</button>
                        {isSuperAdmin && (
                          <button onClick={() => { setRoleChangeUser(u); setNewRole('') }} className="text-xs text-purple-600 hover:text-purple-800 font-medium">Role</button>
                        )}
                        <button
                          onClick={() => toggleActive(u)}
                          className={cn('text-xs font-medium', u.isActive ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800')}
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        {isSuperAdmin && u.id !== session?.id && u.email !== 'admin@trustivasetu.com' && (
                          <button onClick={() => handleDeleteUser(u)} className="text-xs text-red-600 hover:text-red-800 font-medium border-l border-gray-200 pl-2">Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-10">No users found</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ── Hospital Users Tab ────────────────────────────────────────────────────────

function HospitalUsersTab({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [users, setUsers] = useState<HospitalUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [resetPasswordUser, setResetPasswordUser] = useState<HospitalUser | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetConfirm, setResetConfirm] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    const res = await fetch(`/api/hospital-users?${p}`)
    const data = await res.json()
    setUsers(data.data ?? [])
    setLoading(false)
  }, [search])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function toggleActive(user: HospitalUser) {
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !user.isActive }),
    })
    if (res.ok) { toast.success('User updated'); fetchUsers() }
    else toast.error('Failed to update user')
  }

  async function handleDelete(user: HospitalUser) {
    if (!confirm(`Delete portal access for ${user.clinic?.name ?? user.name}? This cannot be undone.`)) return
    const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Portal user deleted'); fetchUsers() }
    else { const d = await res.json(); toast.error(d.error ?? 'Failed to delete') }
  }

  async function handleResend(user: HospitalUser) {
    if (!user.clinic?.id) { toast.error('No clinic linked'); return }
    setResendLoading(user.id)
    try {
      const res = await fetch(`/api/clinics/${user.clinic.id}/portal-access`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return }
      toast.success(`Access email resent to ${data.email}`)
      fetchUsers()
    } catch { toast.error('Something went wrong') }
    finally { setResendLoading(null) }
  }

  async function handleResetPassword() {
    if (!resetPasswordUser?.clinic?.id) { toast.error('No clinic linked'); return }
    if (resetPassword.length < 8) { toast.error('Password must be at least 8 characters'); return }
    if (resetPassword !== resetConfirm) { toast.error('Passwords do not match'); return }

    setResetLoading(true)
    try {
      const res = await fetch(`/api/clinics/${resetPasswordUser.clinic.id}/portal-access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPassword }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed'); return }
      toast.success('Password reset successfully — email sent')
      setResetPasswordUser(null)
      setResetPassword('')
      setResetConfirm('')
    } catch { toast.error('Something went wrong') }
    finally { setResetLoading(false) }
  }

  return (
    <>
      {/* Search */}
      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Search by hospital name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 w-72"
        />
        <span className="text-xs text-gray-400 ml-2">{users.length} hospital user{users.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-base font-semibold text-gray-800">Reset Portal Password</h2>
              <button onClick={() => { setResetPasswordUser(null); setResetPassword(''); setResetConfirm('') }} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Resetting password for <strong>{resetPasswordUser.clinic?.name ?? resetPasswordUser.name}</strong>
              <br /><span className="text-xs text-gray-400">{resetPasswordUser.email}</span>
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">New Password</label>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={e => setResetPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Confirm Password</label>
                <input
                  type="password"
                  value={resetConfirm}
                  onChange={e => setResetConfirm(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
              {resetPassword && resetConfirm && resetPassword !== resetConfirm && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={handleResetPassword}
                disabled={resetLoading || !resetPassword || resetPassword !== resetConfirm}
                className="flex-1 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-60"
              >
                {resetLoading ? 'Resetting...' : 'Reset & Send Email'}
              </button>
              <button
                onClick={() => { setResetPasswordUser(null); setResetPassword(''); setResetConfirm('') }}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Hospital Name', 'Email', 'Portal Created On', 'Last Login', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase whitespace-nowrap tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold text-xs flex-shrink-0">
                          {(u.clinic?.name ?? u.name).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{u.clinic?.name ?? '—'}</p>
                          {u.mustChangePassword && (
                            <span className="text-[10px] text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded">Awaiting first login</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatDate(u.createdAt)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {u.lastLoginAt ? formatDate(u.lastLoginAt) : <span className="text-gray-300 italic">Never</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold', u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 flex-wrap items-center">
                        <button
                          onClick={() => setResetPasswordUser(u)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          Reset Password
                        </button>
                        <button
                          onClick={() => handleResend(u)}
                          disabled={resendLoading === u.id}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-60"
                        >
                          {resendLoading === u.id ? 'Sending...' : 'Resend Access'}
                        </button>
                        <button
                          onClick={() => toggleActive(u)}
                          className={cn('text-xs font-medium', u.isActive ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800')}
                        >
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        {isSuperAdmin && (
                          <button
                            onClick={() => handleDelete(u)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium border-l border-gray-200 pl-2"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length === 0 && (
              <p className="text-center text-sm text-gray-400 py-10">No hospital portal users found</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ── UserForm ───────────────────────────────────────────────────────────────────

function UserForm({
  initial,
  onSuccess,
  onCancel,
  isSuperAdmin,
  excludeId,
}: {
  initial: User | null
  onSuccess: () => void
  onCancel: () => void
  isSuperAdmin?: boolean
  excludeId?: string
}) {
  const isEdit = !!initial?.id

  const [form, setForm] = useState({
    name: initial?.name ?? '',
    email: initial?.email ?? '',
    password: '',
    role: initial?.role ?? 'TEAM_MEMBER',
    phone: initial?.phone ?? '',
    designation: initial?.designation ?? '',
    reportingManagerId: initial?.reportingManagerId ?? '',
  })

  const [allUsers, setAllUsers] = useState<MinimalUser[]>([])
  const [regions, setRegions] = useState<{ id: string; name: string }[]>([])
  const [clinics, setClinics] = useState<{ id: string; name: string }[]>([])
  const [selectedRegions, setSelectedRegions] = useState<string[]>(
    initial?.regionAssignments.map(r => r.region.id) ?? []
  )
  const [selectedClinics, setSelectedClinics] = useState<string[]>(
    initial?.clinicAssignments.map(c => c.clinic.id) ?? []
  )
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'info' | 'access'>('info')

  useEffect(() => {
    Promise.all([
      fetch('/api/users?minimal=1').then(r => r.ok ? r.json() : { data: [] }),
      fetch('/api/regions').then(r => r.ok ? r.json() : { data: [] }),
      fetch('/api/clinics?minimal=1').then(r => r.ok ? r.json() : { data: [] }),
    ]).then(([u, r, c]) => {
      setAllUsers((u.data ?? []).filter((u: MinimalUser) => u.id !== excludeId))
      setRegions(r.data ?? [])
      setClinics(c.data ?? [])
    }).catch(() => {})
  }, [excludeId])

  const reportingOptions = useMemo(() => {
    if (!form.designation) return allUsers
    const myLevel = DESIGNATION_LEVEL[form.designation]
    if (!myLevel) return allUsers
    return allUsers.filter(u => {
      if (!u.designation) return true
      const theirLevel = DESIGNATION_LEVEL[u.designation]
      if (!theirLevel) return true
      return theirLevel < myLevel
    })
  }, [form.designation, allUsers])

  function upd(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        role: form.role,
        phone: form.phone || null,
        designation: form.designation || null,
        reportingManagerId: form.reportingManagerId || null,
        regionIds: selectedRegions,
        clinicIds: selectedClinics,
      }
      if (form.password) payload.password = form.password
      if (!isEdit) {
        if (!form.password) throw new Error('Password is required for new users')
        payload.email = form.email
      }

      const url = isEdit ? `/api/users/${initial!.id}` : '/api/users'
      const method = isEdit ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Failed') }
      toast.success(isEdit ? 'User updated successfully' : 'User created successfully')
      onSuccess()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Operation failed')
    } finally {
      setLoading(false)
    }
  }

  const tabCls = (t: string) => cn(
    'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
    tab === t ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
  )

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex gap-2">
        <button type="button" className={tabCls('info')} onClick={() => setTab('info')}>User Info</button>
        <button type="button" className={tabCls('access')} onClick={() => setTab('access')}>Access & Regions</button>
      </div>

      {tab === 'info' && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Full Name *</label>
            <input type="text" value={form.name} onChange={e => upd('name', e.target.value)} required placeholder="e.g. Ajit Yadav"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          {!isEdit && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email * (@trustivasetu.com)</label>
              <input type="email" value={form.email} onChange={e => upd('email', e.target.value)} required placeholder="name@trustivasetu.com"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">{isEdit ? 'New Password (leave blank to keep current)' : 'Password *'}</label>
            <input type="password" value={form.password} onChange={e => upd('password', e.target.value)} required={!isEdit} minLength={8}
              placeholder={isEdit ? 'Leave blank to keep current' : 'Minimum 8 characters'}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone Number</label>
            <input type="tel" value={form.phone} onChange={e => upd('phone', e.target.value)} placeholder="10-digit mobile number"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>
          <div className="border-t border-gray-100 pt-4 space-y-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Role & Hierarchy</p>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Designation</label>
              <select value={form.designation} onChange={e => { upd('designation', e.target.value); upd('reportingManagerId', '') }}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                <option value="">— Select designation —</option>
                {ALL_DESIGNATIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">User Role *</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'ADMIN', label: 'Admin', desc: 'Full LMS access' },
                  { value: 'REGIONAL_MANAGER', label: 'Manager', desc: 'Regional data access' },
                  { value: 'TEAM_MEMBER', label: 'Team Member', desc: 'Assigned clinics only' },
                  ...(isSuperAdmin ? [{ value: 'SUPER_ADMIN', label: 'Super Admin', desc: 'Full system access' }] : []),
                ].map(opt => (
                  <button key={opt.value} type="button" onClick={() => upd('role', opt.value)}
                    className={cn('text-left px-3 py-2.5 rounded-xl border-2 transition text-sm',
                      form.role === opt.value ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-300')}>
                    <p className={cn('font-semibold text-xs', form.role === opt.value ? 'text-brand-700' : 'text-gray-700')}>{opt.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Reporting To
                {form.designation && reportingOptions.length < allUsers.length && (
                  <span className="ml-2 font-normal text-amber-600 text-xs">Filtered to {reportingOptions.length} above your level</span>
                )}
              </label>
              <select value={form.reportingManagerId} onChange={e => upd('reportingManagerId', e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400">
                <option value="">— No reporting manager —</option>
                {reportingOptions.map(u => <option key={u.id} value={u.id}>{formatManagerLabel(u)}</option>)}
              </select>
            </div>
          </div>
          <button type="button" onClick={() => setTab('access')}
            className="w-full py-2.5 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition">
            Next: Access & Regions →
          </button>
        </div>
      )}

      {tab === 'access' && (
        <div className="space-y-4">
          {(form.role === 'ADMIN' || form.role === 'SUPER_ADMIN') && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-purple-800">{form.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'} — Full System Access</p>
              <p className="text-xs text-purple-600 mt-1">No region or clinic assignment needed.</p>
            </div>
          )}
          {form.role === 'REGIONAL_MANAGER' && (
            <div className="space-y-3">
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-3">
                <p className="text-sm font-semibold text-teal-800">Assign Regions</p>
              </div>
              <div className="border border-gray-200 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1.5">
                {regions.map(r => (
                  <label key={r.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded-lg">
                    <input type="checkbox" checked={selectedRegions.includes(r.id)}
                      onChange={e => setSelectedRegions(prev => e.target.checked ? [...prev, r.id] : prev.filter(x => x !== r.id))}
                      className="rounded text-brand-600" />
                    <span className="text-sm text-gray-700">{r.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {form.role === 'TEAM_MEMBER' && (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-sm font-semibold text-green-800">Assign Clinics</p>
              </div>
              <div className="border border-gray-200 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1.5">
                {clinics.map(c => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded-lg">
                    <input type="checkbox" checked={selectedClinics.includes(c.id)}
                      onChange={e => setSelectedClinics(prev => e.target.checked ? [...prev, c.id] : prev.filter(x => x !== c.id))}
                      className="rounded text-green-600" />
                    <span className="text-sm text-gray-700">{c.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3 pt-3 border-t border-gray-100">
        <button type="submit" disabled={loading}
          className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition disabled:opacity-60">
          {loading ? 'Saving...' : isEdit ? 'Update User' : 'Create User'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-6 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition">
          Cancel
        </button>
      </div>
    </form>
  )
}
