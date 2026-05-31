import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const notifications = await db.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({ data: notifications })
}

export async function PATCH(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (id === 'all') {
    await db.notification.updateMany({ where: { userId: session.user.id, isRead: false }, data: { isRead: true } })
  } else {
    await db.notification.update({ where: { id, userId: session.user.id }, data: { isRead: true } })
  }

  return NextResponse.json({ success: true })
}
