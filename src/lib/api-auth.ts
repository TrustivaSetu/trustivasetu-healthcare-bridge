import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { hasPermission, type Permission } from '@/lib/permissions'
import { headers } from 'next/headers'
import { verifyTabToken, isTabSessionActive } from '@/lib/tab-session'

export type SessionUser = {
  id: string
  email: string
  name: string
  role: string
  regionIds: string[]
  clinicIds: string[]
  mustChangePassword?: boolean
}

/**
 * Reads the current user from either:
 * 1. Authorization: Bearer <jwt> header — validated cryptographically against the JWT secret
 *    and confirmed active in the DB. Primary path for all API calls.
 * 2. NextAuth cookie session — fallback for page navigation and server components.
 *
 * NOTE: The x-tab-user header (set by middleware for page routes) is intentionally NOT
 * trusted here. Any client can send arbitrary x-tab-user values; trusting it without
 * re-verification would be an authentication bypass. Page routes fall through to path 2.
 */
export async function getRequestSession(): Promise<{ user: SessionUser } | null> {
  const headersList = await headers()

  // 1. Direct Bearer token validation (primary path for all tab-session API calls).
  //    Verify JWT signature first (fast), then confirm the DB record still exists
  //    so that logged-out tokens are immediately rejected.
  const authHeader = headersList.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    const payload = await verifyTabToken(token)
    if (payload && await isTabSessionActive(token)) {
      return { user: payload as SessionUser }
    }
    // Bearer token present but invalid/expired — reject immediately, don't fall through.
    return null
  }

  // 2. NextAuth cookie session (page navigation / server components)
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
