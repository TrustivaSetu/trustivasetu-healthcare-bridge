import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { jwtVerify } from 'jose'

const ADMIN_ROLES = ['SUPER_ADMIN', 'ADMIN'] as const
const ADMIN_ONLY_PREFIXES = ['/users', '/admin']

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
    const isAdminRoute = ADMIN_ONLY_PREFIXES.some(
      prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)
    )
    if (isAdminRoute && !ADMIN_ROLES.includes(role as (typeof ADMIN_ROLES)[number])) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Pass validated user data to the API route via a request header.
    // Use btoa + TextEncoder instead of Buffer — Buffer is not available in Edge runtime.
    const jsonStr = JSON.stringify(payload)
    const bytes = new TextEncoder().encode(jsonStr)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const userBase64 = btoa(binary)
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-tab-user', userBase64)
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // Fall back to NextAuth JWT cookie for page navigation requests
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET! })

  if (!token) {
    return NextResponse.redirect(new URL('/lms/login', req.url))
  }

  const role = token.role as string | undefined
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
