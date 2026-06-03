'use client'

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'

const TOKEN_KEY = 'trustiva-tab-token'

export interface TabUser {
  id: string
  email: string
  name: string
  role: string
  regionIds: string[]
  clinicIds: string[]
  mustChangePassword?: boolean
}

export interface TabSessionState {
  user: TabUser | null
  status: 'loading' | 'authenticated' | 'unauthenticated'
}

// Decode JWT payload without verifying signature (verification happens server-side on every request)
function decodeTabToken(token: string): (TabUser & { exp?: number }) | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const decoded = JSON.parse(atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), '=')))
    if (!decoded?.id || !decoded?.role) return null
    return decoded as TabUser & { exp?: number }
  } catch {
    return null
  }
}

function readSessionFromStorage(): TabSessionState {
  if (typeof window === 'undefined') return { user: null, status: 'loading' }
  const token = sessionStorage.getItem(TOKEN_KEY)
  if (!token) return { user: null, status: 'unauthenticated' }

  const payload = decodeTabToken(token)
  if (!payload) {
    sessionStorage.removeItem(TOKEN_KEY)
    return { user: null, status: 'unauthenticated' }
  }

  // Check token expiry
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    sessionStorage.removeItem(TOKEN_KEY)
    return { user: null, status: 'unauthenticated' }
  }

  const { exp: _exp, ...user } = payload
  return { user: user as TabUser, status: 'authenticated' }
}

// ---- Context ----

const TabSessionContext = createContext<TabSessionState>({ user: null, status: 'loading' })

export function useTabSession(): TabSessionState {
  return useContext(TabSessionContext)
}

// ---- Public utilities ----

export function getTabToken(): string | null {
  if (typeof window === 'undefined') return null
  return sessionStorage.getItem(TOKEN_KEY)
}

export function storeTabToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token)
}

export async function tabSignOut(redirectUrl = '/lms/login'): Promise<void> {
  const token = getTabToken()
  if (token) {
    await fetch('/api/auth/tab-logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {})
    sessionStorage.removeItem(TOKEN_KEY)
  }
  window.location.href = redirectUrl
}

// ---- Provider ----

export function TabSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<TabSessionState>({ user: null, status: 'loading' })
  const fetchInterceptorInstalled = useRef(false)

  // Initialize session from sessionStorage
  useEffect(() => {
    setSession(readSessionFromStorage())
  }, [])

  // Install a global fetch interceptor that adds Authorization header to all /api/* calls.
  // This is the mechanism that lets each tab carry its own user identity independently
  // of the shared browser cookie.
  useEffect(() => {
    if (fetchInterceptorInstalled.current) return
    fetchInterceptorInstalled.current = true

    const originalFetch = window.fetch.bind(window)

    window.fetch = function tabAwareFetch(input, init) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url
      const isApiCall = url.startsWith('/api/') || url.startsWith(window.location.origin + '/api/')

      if (isApiCall) {
        const token = sessionStorage.getItem(TOKEN_KEY)
        if (token) {
          const headers = new Headers((init as RequestInit)?.headers ?? {})
          if (!headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${token}`)
          }
          init = { ...(init ?? {}), headers }
        }
      }

      return originalFetch(input as Parameters<typeof fetch>[0], init)
    }

    return () => {
      window.fetch = originalFetch
      fetchInterceptorInstalled.current = false
    }
  }, [])

  // Listen for storage events so that if the token is removed in the same tab
  // (e.g. from another hook calling tabSignOut), the UI updates.
  const refreshFromStorage = useCallback(() => {
    setSession(readSessionFromStorage())
  }, [])

  useEffect(() => {
    // storageEvent fires across tabs for localStorage, not sessionStorage.
    // We use a custom event for same-tab token updates.
    window.addEventListener('trustiva-session-change', refreshFromStorage)
    return () => window.removeEventListener('trustiva-session-change', refreshFromStorage)
  }, [refreshFromStorage])

  return (
    <TabSessionContext.Provider value={session}>
      {children}
    </TabSessionContext.Provider>
  )
}
