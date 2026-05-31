'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import type { ModuleKey, ActionKey } from '@/types/permissions'

interface PermissionsContextValue {
  /** Returns true if the current user can perform action on module */
  can: (module: ModuleKey, action: ActionKey) => boolean
  /** True while the first fetch is in-flight */
  loading: boolean
}

const PermissionsContext = createContext<PermissionsContextValue>({
  can: () => false,
  loading: true,
})

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [flat, setFlat] = useState<Record<string, boolean> | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await fetch('/api/permissions/me')
      if (res.ok) {
        const data = await res.json()
        setFlat(data.permissions as Record<string, boolean>)
      }
    } catch {
      // network error – leave flat null (will use role-based fallback)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchPermissions()
    } else if (status === 'unauthenticated') {
      setLoading(false)
    }
  }, [status, fetchPermissions])

  const role = session?.user?.role as string | undefined

  const can = useCallback(
    (module: ModuleKey, action: ActionKey): boolean => {
      if (!role) return false
      // Admin and Super Admin always have full access
      if (role === 'SUPER_ADMIN' || role === 'ADMIN') return true
      if (!flat) return false
      return flat[`${module}_${action}`] === true
    },
    [role, flat]
  )

  return (
    <PermissionsContext.Provider value={{ can, loading }}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions() {
  return useContext(PermissionsContext)
}
