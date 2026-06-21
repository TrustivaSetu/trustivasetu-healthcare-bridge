import { NextRequest } from 'next/server'

/**
 * Origins allowed to call the public enquiry endpoints cross-origin.
 * The marketing website + the LMS itself. Extend via the ALLOWED_ORIGINS env
 * var (comma-separated) without a code change if a new front-end domain is added.
 */
const DEFAULT_ALLOWED_ORIGINS = [
  'https://trustivasetu.com',
  'https://www.trustivasetu.com',
  'https://lms.trustivasetu.com',
]

function allowedOrigins(): string[] {
  const fromEnv = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  // Allow localhost during development for the marketing site dev server.
  const dev = process.env.NODE_ENV !== 'production' ? ['http://localhost:3000', 'http://localhost:3001'] : []
  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...fromEnv, ...dev])]
}

/**
 * Builds CORS headers that reflect the request Origin only when it is on the
 * allowlist. Unknown origins receive the primary site origin (i.e. no access),
 * replacing the previous wildcard `*` which let any site post PII to us.
 */
export function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  const allowed = allowedOrigins()
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0]
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  }
}
