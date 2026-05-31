import { NextRequest, NextResponse } from 'next/server'
import { deleteTabSessionRecord } from '@/lib/tab-session'
import { db } from '@/lib/db'
import { verifyTabToken } from '@/lib/tab-session'

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null

  if (token) {
    const payload = await verifyTabToken(token)
    if (payload) {
      await db.auditLog.create({
        data: {
          userId: payload.id,
          action: 'LOGOUT',
          entity: 'User',
          entityId: payload.id,
        },
      }).catch(() => {})
    }
    await deleteTabSessionRecord(token)
  }

  return NextResponse.json({ ok: true })
}
