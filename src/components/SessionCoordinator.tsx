'use client'

/**
 * SessionCoordinator — now a no-op.
 *
 * Multi-user multi-tab sessions are handled at the auth layer:
 * each tab stores its own JWT in sessionStorage and sends it via
 * Authorization header on every fetch. There is no shared cookie
 * interference to coordinate.
 */

export const SESSION_CHANNEL = 'trustiva_lms_session'

export type SessionMessage =
  | { type: 'SIGNED_IN'; userId: string; userName: string }
  | { type: 'SIGNED_OUT'; userId: string }

export function broadcastSession(_msg: SessionMessage) {
  // No longer needed — tab sessions are independent.
}

export function SessionCoordinator() {
  return null
}
