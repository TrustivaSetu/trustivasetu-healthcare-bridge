'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useTabSession } from '@/contexts/TabSessionContext'
import type { ModuleKey, ActionKey } from '@/types/permissions'

interface PermissionsContextValue {
  can: (module: ModuleKey, action: ActionKey) => boolean
  loading: boolean
}

const PermissionsContext = createContext<PermissionsContextValue>({
  can: () => false,
  loading: true,
})

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { user, status } = useTabSession()
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
      // network error — leave flat null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated') fetchPermissions()
    else if (status === 'unauthenticated') setLoading(false)
  }, [status, fetchPermissions])

  const role = user?.role as string | undefined

  const can = useCallback(
    (module: ModuleKey, action: ActionKey): boolean => {
      if (!role) return false
      if (role === 'SUPER_ADMIN') return true
      if (loading || !flat) return role === 'ADMIN'
      return flat[`${module}_${action}`] === true
    },
    [role, flat, loading]
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
