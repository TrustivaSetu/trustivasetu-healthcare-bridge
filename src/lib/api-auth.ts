import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { hasPermission, type Permission } from '@/lib/permissions'
import { headers } from 'next/headers'

export type SessionUser = {
  id: string
  email: string
  name: string
  role: string
  regionIds: string[]
  clinicIds: string[]
}

/**
 * Reads the current user from either:
 * 1. The x-tab-user header (set by middleware after validating a tab-specific JWT)
 * 2. The NextAuth cookie session (fallback for page navigation / legacy requests)
 *
 * This allows multiple different users to be simultaneously logged in across
 * different browser tabs — each tab carries its own Bearer token in sessionStorage
 * and sends it via the Authorization header on every fetch call.
 */
export async function getRequestSession(): Promise<{ user: SessionUser } | null> {
  const headersList = await headers()
  const tabUserHeader = headersList.get('x-tab-user')

  if (tabUserHeader) {
    try {
      const userData = JSON.parse(Buffer.from(tabUserHeader, 'base64').toString('utf-8'))
      if (userData?.id && userData?.role) {
        return { user: userData as SessionUser }
      }
    } catch {
      // corrupted header — fall through to NextAuth
    }
  }

  return getServerSession(authOptions) as Promise<{ user: SessionUser } | null>
}

export async function requireSession() {
  const session = await getRequestSession()
  if (!session?.user?.id) {
    return { session: null, user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const user = session.user as SessionUser
  return { session, user, error: null }
}

export async function requirePermission(permission: Permission) {
  const result = await requireSession()
  if (result.error) return result
  if (!hasPermission(result.user!.role, permission)) {
    return { ...result, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return result
}

export function jsonError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status })
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status })
}
