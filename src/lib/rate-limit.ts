/**
 * Database-backed rate limiter for serverless environments.
 * Uses OtpToken.blockedUntil pattern for auth endpoints.
 */
import { db } from './db'

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds?: number
}

/**
 * Track failed login attempts per email using AuditLog.
 * Blocks after `maxAttempts` failures within `windowSeconds`.
 * The block clears after `blockSeconds`.
 */
export async function checkLoginRateLimit(
  email: string,
  maxAttempts = 5,
  windowSeconds = 15 * 60,
  blockSeconds = 15 * 60,
): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - windowSeconds * 1000)

  const recentFailures = await db.auditLog.count({
    where: {
      entity: 'LoginAttempt',
      entityId: email,
      action: 'FAILED',
      createdAt: { gte: windowStart },
    },
  })

  if (recentFailures >= maxAttempts) {
    const earliest = await db.auditLog.findFirst({
      where: {
        entity: 'LoginAttempt',
        entityId: email,
        action: 'FAILED',
        createdAt: { gte: windowStart },
      },
      orderBy: { createdAt: 'asc' },
    })
    const unblockAt = earliest
      ? new Date(earliest.createdAt.getTime() + blockSeconds * 1000)
      : new Date(Date.now() + blockSeconds * 1000)
    const retryAfterSeconds = Math.ceil((unblockAt.getTime() - Date.now()) / 1000)
    return { allowed: false, retryAfterSeconds: Math.max(0, retryAfterSeconds) }
  }

  return { allowed: true }
}

export async function recordFailedLogin(email: string): Promise<void> {
  await db.auditLog.create({
    data: { action: 'FAILED', entity: 'LoginAttempt', entityId: email },
  })
}

/**
 * Per-phone OTP send throttle: max `maxSends` sends in `windowSeconds`.
 * Uses the OtpToken table — a recent unexpired token means one was just sent.
 */
export async function checkPublicLeadRateLimit(
  ip: string,
  maxLeads = 5,
  windowSeconds = 60 * 60,
): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - windowSeconds * 1000)
  const count = await db.auditLog.count({
    where: { entity: 'PublicLead', entityId: ip, action: 'CREATE', createdAt: { gte: windowStart } },
  })
  if (count >= maxLeads) return { allowed: false, retryAfterSeconds: windowSeconds }
  return { allowed: true }
}

export async function checkOtpSendRateLimit(
  phone: string,
  maxSends = 3,
  windowSeconds = 5 * 60,
): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - windowSeconds * 1000)
  const key = `pub_${phone}`

  const recentCount = await db.otpToken.count({
    where: {
      email: key,
      purpose: 'PUBLIC_PHONE_OTP',
      createdAt: { gte: windowStart },
    },
  })

  if (recentCount >= maxSends) {
    return { allowed: false, retryAfterSeconds: windowSeconds }
  }

  return { allowed: true }
}
