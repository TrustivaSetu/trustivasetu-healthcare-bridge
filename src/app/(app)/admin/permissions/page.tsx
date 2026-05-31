'use client'

import { useEffect, useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import {
  MODULE_KEYS,
  ACTION_KEYS,
  MODULE_LABELS,
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

function buildClientDefault(): RolePermissionMatrix {
  const m = {} as RolePermissionMatrix
  for (const role of MANAGED_ROLES) {
    m[role] = {} as RolePermissionMatrix[ManagedRole]
    for (const mod of MODULE_KEYS) {
      m[role][mod] = {} as Record<ActionKey, boolean>
      for (const action of ACTION_KEYS) {
        const applicable = (MODULE_ACTIONS[mod] as readonly ActionKey[]).includes(action)
        m[role][mod][action] = applicable
          ? DEFAULT_PERMISSIONS[role][mod].includes(action)
          : false
      }
    }
  }
  return m
}

export default function PermissionsPage() {
  const [matrix, setMatrix] = useState<RolePermissionMatrix>(buildClientDefault)
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

  function toggle(mod: ModuleKey, action: ActionKey) {
    const applicable = (MODULE_ACTIONS[mod] as readonly ActionKey[]).includes(action)
    if (!applicable) return
    setMatrix(prev => ({
      ...prev,
      [activeRole]: {
        ...prev[activeRole],
        [mod]: {
          ...prev[activeRole][mod],
          [action]: !prev[activeRole][mod][action],
        },
      },
    }))
    setDirty(true)
  }

  function setAll(mod: ModuleKey, value: boolean) {
    setMatrix(prev => {
      const updated = { ...prev[activeRole][mod] }
      for (const action of MODULE_ACTIONS[mod]) {
        updated[action] = value
      }
      return {
        ...prev,
        [activeRole]: { ...prev[activeRole], [mod]: updated },
      }
    })
    setDirty(true)
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: activeRole, permissions: matrix[activeRole] }),
      })
      if (!res.ok) throw new Error('Save failed')
      toast.success(`Permissions saved for ${ROLE_LABELS[activeRole]}`)
      setDirty(false)
    } catch {
      toast.error('Failed to save permissions')
    } finally {
      setSaving(false)
    }
  }

  const roleMatrix = matrix[activeRole]

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-6 space-y-6 max-w-5xl mx-auto w-full">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Role Permissions</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Configure what each role can access and do across the LMS
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={fetchMatrix}
              className="px-4 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200 font-medium">
              Reset
            </button>
            <button
              onClick={save}
              disabled={saving || !dirty}
              className="px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 transition"
            >
              {saving ? 'Saving…' : dirty ? 'Save Changes' : 'Saved'}
            </button>
          </div>
        </div>

        {/* Admin notice */}
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-purple-800">
            Super Admin &amp; Admin — Always Full Access
          </p>
          <p className="text-xs text-purple-600 mt-0.5">
            These roles have all permissions by default and cannot be restricted. Configure permissions for the roles below.
          </p>
        </div>

        {/* Role tabs */}
        <div className="flex gap-2">
          {MANAGED_ROLES.map(role => (
            <button
              key={role}
              onClick={() => setActiveRole(role)}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                activeRole === role
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {ROLE_LABELS[role]}
            </button>
          ))}
        </div>

        {/* Matrix table */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-5 py-3 text-left font-semibold text-gray-700 w-48">
                      Module
                    </th>
                    {ACTION_KEYS.map(action => (
                      <th key={action} className="px-4 py-3 text-center font-semibold text-gray-600 whitespace-nowrap">
                        {ACTION_LABELS[action]}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center font-semibold text-gray-500 text-xs whitespace-nowrap">
                      Toggle All
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {MODULE_KEYS.map((mod, i) => {
                    const applicable = MODULE_ACTIONS[mod] as readonly ActionKey[]
                    const allGranted = applicable.every(a => roleMatrix[mod][a])
                    const noneGranted = applicable.every(a => !roleMatrix[mod][a])

                    return (
                      <tr
                        key={mod}
                        className={`border-b border-gray-100 last:border-0 transition-colors ${
                          i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                        } hover:bg-blue-50/30`}
                      >
                        <td className="px-5 py-3.5">
                          <div>
                            <p className="font-medium text-gray-800">{MODULE_LABELS[mod]}</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {applicable.join(', ').toLowerCase()}
                            </p>
                          </div>
                        </td>
                        {ACTION_KEYS.map(action => {
                          const isApplicable = applicable.includes(action)
                          const checked = roleMatrix[mod][action]
                          return (
                            <td key={action} className="px-4 py-3.5 text-center">
                              {isApplicable ? (
                                <label className="inline-flex items-center justify-center cursor-pointer group">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggle(mod, action)}
                                    className="sr-only"
                                  />
                                  <span
                                    className={`
                                      w-5 h-5 rounded flex items-center justify-center border-2 transition-all
                                      ${checked
                                        ? 'bg-blue-600 border-blue-600 text-white'
                                        : 'border-gray-300 bg-white group-hover:border-blue-400'
                                      }
                                    `}
                                  >
                                    {checked && (
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </span>
                                </label>
                              ) : (
                                <span className="inline-block w-5 h-5 rounded bg-gray-100 border border-gray-200" title="Not applicable" />
                              )}
                            </td>
                          )
                        })}
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setAll(mod, true)}
                              disabled={allGranted}
                              title="Grant all"
                              className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-30 transition"
                            >
                              All
                            </button>
                            <button
                              onClick={() => setAll(mod, false)}
                              disabled={noneGranted}
                              title="Revoke all"
                              className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-30 transition"
                            >
                              None
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer summary */}
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Editing permissions for: <span className="font-semibold text-gray-700">{ROLE_LABELS[activeRole]}</span>
              </p>
              {dirty && (
                <span className="text-xs text-amber-600 font-medium">
                  ● Unsaved changes
                </span>
              )}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded border-2 border-blue-600 bg-blue-600 inline-block" />
            Permission granted
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded border-2 border-gray-300 bg-white inline-block" />
            Permission denied
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded bg-gray-100 border border-gray-200 inline-block" />
            Not applicable to this module
          </div>
        </div>
      </div>
    </div>
  )
}
