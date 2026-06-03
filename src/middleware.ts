import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { jwtVerify } from 'jose'

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'] as const
const ADMIN_ONLY_PREFIXES = ['/users', '/admin']
const CLINIC_USER_ALLOWED_PREFIX = '/dashboard/clinic'

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)

async function validateTabToken(token: string): Promise<Record<string, unknown> | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    if (typeof payload.id !== 'string' || typeof payload.role !== 'string') return null
    return payload as Record<string, unknown>
  } catch {
    return null
  }
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Check for tab-specific Authorization header first (API/JS fetch calls)
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const rawToken = authHeader.slice(7)
    const payload = await validateTabToken(rawToken)

    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = payload.role as string

    // CLINIC_USER API calls: only allow /api/clinic/* and /api/auth/* endpoints
    if (role === 'CLINIC_USER') {
      const allowedApiPrefixes = ['/api/clinic/', '/api/auth/', '/api/hr/photo']
      const allowed = allowedApiPrefixes.some(p => pathname.startsWith(p))
      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return NextResponse.next()
    }

    const isAdminRoute = ADMIN_ONLY_PREFIXES.some(
      prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)
    )
    if (isAdminRoute && !ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number])) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  }

  // Fall back to NextAuth JWT cookie for page navigation requests
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET! })

  if (!token) {
    return NextResponse.redirect(new URL('/lms/login', req.url))
  }

  const role = token.role as string | undefined

  // CLINIC_USER page routing
  if (role === 'CLINIC_USER') {
    const mustChange = token.mustChangePassword as boolean | undefined
    const changePasswordPath = '/dashboard/clinic/change-password'

    // Force to change password page if mustChangePassword is set
    if (mustChange && pathname !== changePasswordPath) {
      return NextResponse.redirect(new URL(changePasswordPath, req.url))
    }

    // Restrict CLINIC_USER to /dashboard/clinic/* only
    if (!pathname.startsWith(CLINIC_USER_ALLOWED_PREFIX)) {
      return NextResponse.redirect(new URL(CLINIC_USER_ALLOWED_PREFIX, req.url))
    }

    return NextResponse.next()
  }

  // Non-CLINIC_USER trying to access clinic portal — redirect to main dashboard
  if (pathname.startsWith(CLINIC_USER_ALLOWED_PREFIX)) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  const isAdminRoute = ADMIN_ONLY_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
  if (isAdminRoute && role && !ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number])) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/clinics/:path*',
    '/leads/:path*',
    '/reports/:path*',
    '/users/:path*',
    '/admin/:path*',
    '/hr/:path*',
    '/expenses/:path*',
  ],
}
