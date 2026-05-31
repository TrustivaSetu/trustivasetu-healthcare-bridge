'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTabSession } from '@/contexts/TabSessionContext'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import {
  MODULE_KEYS,
  ACTION_KEYS,
  MODULE_LABELS,
  MODULE_GROUP,
  ACTION_LABELS,
  MODULE_ACTIONS,
  MANAGED_ROLES,
  ROLE_LABELS,
  DEFAULT_PERMISSIONS,
  type ModuleKey,
  type ActionKey,
  type ManagedRole,
  type RolePermissionMatrix,
} from '@/types/permissions'

function buildAllOn(): RolePermissionMatrix {
  const m = {} as RolePermissionMatrix
  for (const role of MANAGED_ROLES) {
    m[role] = {} as RolePermissionMatrix[ManagedRole]
    for (const mod of MODULE_KEYS) {
      m[role][mod] = {} as Record<ActionKey, boolean>
      for (const action of ACTION_KEYS) {
        m[role][mod][action] = (MODULE_ACTIONS[mod] as readonly ActionKey[]).includes(action)
      }
    }
  }
  return m
}

function buildFromDefaults(): RolePermissionMatrix {
  const m = {} as RolePermissionMatrix
  for (const role of MANAGED_ROLES) {
    m[role] = {} as RolePermissionMatrix[ManagedRole]
    for (const mod of MODULE_KEYS) {
      m[role][mod] = {} as Record<ActionKey, boolean>
      for (const action of ACTION_KEYS) {
        const applicable = (MODULE_ACTIONS[mod] as readonly ActionKey[]).includes(action)
        m[role][mod][action] = applicable
          ? (DEFAULT_PERMISSIONS[role][mod] as ActionKey[]).includes(action)
          : false
      }
    }
  }
  return m
}

const GROUPS = ['Core', 'HR', 'Administration'] as const
type Group = (typeof GROUPS)[number]
const MODULES_BY_GROUP: Record<Group, ModuleKey[]> = { Core: [], HR: [], Administration: [] }
for (const mod of MODULE_KEYS) {
  const g = MODULE_GROUP[mod] as Group
  if (MODULES_BY_GROUP[g]) MODULES_BY_GROUP[g].push(mod)
}

const GROUP_COLORS: Record<Group, string> = {
  Core:           'bg-blue-100 text-blue-700 border-blue-200',
  HR:             'bg-green-100 text-green-700 border-green-200',
  Administration: 'bg-purple-100 text-purple-700 border-purple-200',
}

export default function PermissionsPage() {
  const { user: session } = useTabSession()
  const isSuperAdmin = session?.role === 'SUPER_ADMIN'

  const visibleRoles = isSuperAdmin
    ? MANAGED_ROLES
    : (MANAGED_ROLES.filter(r => r !== 'ADMIN') as ManagedRole[])

  const [matrix, setMatrix] = useState<RolePermissionMatrix>(buildFromDefaults)
  const [activeRole, setActiveRole] = useState<ManagedRole>('REGIONAL_MANAGER')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  const fetchMatrix = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/permissions')
      if (res.ok) {
        const data = await res.json()
        setMatrix(data.matrix as RolePermissionMatrix)
        setDirty(false)
      }
    } catch {
      toast.error('Failed to load permissions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchMatrix() }, [fetchMatrix])

  useEffect(() => {
    if (!visibleRoles.includes(activeRole)) setActiveRole(visibleRoles[0] ?? 'REGIONAL_MANAGER')
  }, [activeRole, visibleRoles])

  function toggle(mod: ModuleKey, action: ActionKey) {
    if (!(MODULE_ACTIONS[mod] as readonly ActionKey[]).includes(action)) return
    setMatrix(prev => ({
      ...prev,
      [activeRole]: {
        ...prev[activeRole],
        [mod]: { ...prev[activeRole][mod], [action]: !prev[activeRole][mod][action] },
      },
    }))
    setDirty(true)
  }

  function setRowAll(mod: ModuleKey, value: boolean) {
    const applicable = MODULE_ACTIONS[mod] as readonly ActionKey[]
    setMatrix(prev => {
      const updated = { ...prev[activeRole][mod] }
      for (const a of applicable) updated[a] = value
      return { ...prev, [activeRole]: { ...prev[activeRole], [mod]: updated } }
    })
    setDirty(true)
  }

  function setColAll(action: ActionKey, value: boolean) {
    setMatrix(prev => {
      const rolePerms = { ...prev[activeRole] }
      for (const mod of MODULE_KEYS) {
        if ((MODULE_ACTIONS[mod] as readonly ActionKey[]).includes(action))
          rolePerms[mod] = { ...rolePerms[mod], [action]: value }
      }
      return { ...prev, [activeRole]: rolePerms }
    })
    setDirty(true)
  }

  function resetToAllOn() {
    setMatrix(prev => ({ ...prev, [activeRole]: buildAllOn()[activeRole] }))
    setDirty(true)
    toast.success('All permissions ON — click Save to apply')
  }

  function resetToDefaults() {
    setMatrix(prev => ({ ...prev, [activeRole]: buildFromDefaults()[activeRole] }))
    setDirty(true)
    toast.success('Reset to recommended defaults — click Save to apply')
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: activeRole, permissions: matrix[activeRole] }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Save failed') }
      toast.success(`Permissions saved for ${ROLE_LABELS[activeRole]}`)
      setDirty(false)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const roleMatrix = matrix[activeRole]
  const totalApplicable = MODULE_KEYS.reduce((s, m) => s + MODULE_ACTIONS[m].length, 0)
  const totalGranted = MODULE_KEYS.reduce((s, m) =>
    s + MODULE_ACTIONS[m].filter(a => roleMatrix?.[m]?.[a]).length, 0)

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Permissions Matrix</h1>
          <p className="text-sm text-gray-500">
            {isSuperAdmin
              ? 'Configure access for Admin, Manager, and Team Member roles. Super Admin always has full access.'
              : 'Configure access for Manager and Team Member roles.'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={resetToDefaults}
            className="px-3 py-1.5 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-50 transition">
            Reset to Defaults
          </button>
          <button onClick={resetToAllOn}
            className="px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-semibold rounded-lg hover:bg-green-100 transition">
            Turn All ON
          </button>
          <button onClick={save} disabled={!dirty || saving}
            className={cn('px-5 py-1.5 text-sm font-bold rounded-lg transition',
              dirty ? 'bg-brand-600 hover:bg-brand-700 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed')}>
            {saving ? 'Saving...' : dirty ? '● Save Changes' : 'Saved'}
          </button>
        </div>
      </div>

      {/* Super Admin notice */}
      {isSuperAdmin && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-sm text-purple-800 flex items-start gap-2">
          <span className="text-xl mt-0.5">👑</span>
          <div>
            <strong>Super Admin</strong> always has full, unrestricted access and is not subject to any permissions.
            Use this page to configure what <strong>Admin</strong>, <strong>Manager</strong>, and <strong>Team Member</strong> roles can access.
          </div>
        </div>
      )}

      {/* Role tabs */}
      <div className="flex gap-2 flex-wrap">
        {visibleRoles.map(role => (
          <button key={role} onClick={() => setActiveRole(role)}
            className={cn('px-5 py-2 rounded-xl text-sm font-bold transition border-2',
              activeRole === role
                ? 'bg-brand-600 text-white border-brand-600'
                : 'border-gray-200 text-gray-600 hover:border-brand-300')}>
            {ROLE_LABELS[role]}
            {role === 'ADMIN' && <span className="ml-1.5 text-xs font-normal opacity-70">(Super Admin only)</span>}
          </button>
        ))}
      </div>

      {/* Stats bar */}
      {!loading && roleMatrix && (
        <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-5 py-3">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Granted</p>
            <p className="text-lg font-bold text-gray-900">
              {totalGranted} <span className="text-sm font-normal text-gray-400">/ {totalApplicable} permissions</span>
            </p>
          </div>
          <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full transition-all"
              style={{ width: `${Math.round((totalGranted / totalApplicable) * 100)}%` }} />
          </div>
          <p className="text-sm font-bold text-brand-600 w-12 text-right">
            {Math.round((totalGranted / totalApplicable) * 100)}%
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" /></div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50 border-b-2 border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wide w-56">Module</th>
                  {ACTION_KEYS.map(action => {
                    const colCount = MODULE_KEYS.filter(m => (MODULE_ACTIONS[m] as readonly ActionKey[]).includes(action)).length
                    const colGranted = MODULE_KEYS.filter(m =>
                      (MODULE_ACTIONS[m] as readonly ActionKey[]).includes(action) && roleMatrix?.[m]?.[action]).length
                    return (
                      <th key={action} className="px-3 py-3 text-center w-24">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">{ACTION_LABELS[action]}</p>
                        <div className="flex gap-1 justify-center">
                          <button onClick={() => setColAll(action, true)} disabled={colGranted === colCount}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-30 font-semibold">All</button>
                          <button onClick={() => setColAll(action, false)} disabled={colGranted === 0}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-30 font-semibold">None</button>
                        </div>
                      </th>
                    )
                  })}
                  <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase w-20">Row</th>
                </tr>
              </thead>
              <tbody>
                {GROUPS.map(group => (
                  <>
                    <tr key={`g-${group}`}>
                      <td colSpan={ACTION_KEYS.length + 2} className="px-5 pt-4 pb-1">
                        <span className={cn('inline-block text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border', GROUP_COLORS[group])}>
                          {group}
                        </span>
                      </td>
                    </tr>
                    {MODULES_BY_GROUP[group].map((mod, i) => {
                      const applicable = MODULE_ACTIONS[mod] as readonly ActionKey[]
                      const allGranted = applicable.every(a => roleMatrix?.[mod]?.[a])
                      const noneGranted = applicable.every(a => !roleMatrix?.[mod]?.[a])
                      return (
                        <tr key={mod} className={cn('border-b border-gray-50 transition hover:bg-blue-50/20',
                          i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30')}>
                          <td className="px-5 py-3">
                            <p className="text-sm font-semibold text-gray-800">{MODULE_LABELS[mod]}</p>
                          </td>
                          {ACTION_KEYS.map(action => {
                            const isApplicable = applicable.includes(action)
                            const checked = roleMatrix?.[mod]?.[action] ?? false
                            return (
                              <td key={action} className="px-3 py-3 text-center">
                                {isApplicable ? (
                                  <label className="inline-flex items-center justify-center cursor-pointer group">
                                    <input type="checkbox" checked={checked} onChange={() => toggle(mod, action)} className="sr-only" />
                                    <span className={cn('w-5 h-5 rounded flex items-center justify-center border-2 transition-all',
                                      checked ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-300 bg-white group-hover:border-brand-400')}>
                                      {checked && (
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                      )}
                                    </span>
                                  </label>
                                ) : (
                                  <span className="inline-block w-5 h-5 rounded bg-gray-100 border border-gray-200" title="N/A" />
                                )}
                              </td>
                            )
                          })}
                          <td className="px-4 py-3 text-center">
                            <div className="flex justify-center gap-1">
                              <button onClick={() => setRowAll(mod, true)} disabled={allGranted}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-30 font-semibold">All</button>
                              <button onClick={() => setRowAll(mod, false)} disabled={noneGranted}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-30 font-semibold">None</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              Editing: <strong className="text-gray-700">{ROLE_LABELS[activeRole]}</strong>
              {activeRole === 'ADMIN' && <span className="ml-2 text-purple-600 font-semibold">· Super Admin access only</span>}
            </p>
            {dirty && <span className="text-xs text-amber-600 font-semibold">● Unsaved changes — click Save</span>}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-5 text-xs text-gray-500 pt-1">
        {[
          { cls: 'bg-brand-600 border-brand-600', label: 'Granted' },
          { cls: 'bg-white border-gray-300', label: 'Denied' },
          { cls: 'bg-gray-100 border-gray-200', label: 'Not applicable' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className={cn('w-4 h-4 rounded border-2 inline-block', l.cls)} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  )
}
