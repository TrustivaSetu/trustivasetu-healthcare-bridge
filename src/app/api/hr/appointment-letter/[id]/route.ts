import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const letter = await db.appointmentLetter.findUnique({
    where: { id: params.id },
    include: { user: { select: { id: true, name: true, email: true } } },
  })
  if (!letter) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isAdmin = session.user.role === 'SUPER_ADMIN' || session.user.role === 'ADMIN'
  if (!isAdmin && letter.userId !== session.user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return NextResponse.json({ data: letter })
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const isAdmin = session.user.role === 'SUPER_ADMIN' || session.user.role === 'ADMIN'
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { employmentType, workLocation, designation, department, reportingManagerName, reportingManagerDesignation } = body

  const updated = await db.appointmentLetter.update({
    where: { id: params.id },
    data: {
      ...(employmentType && { employmentType }),
      ...(workLocation !== undefined && { workLocation }),
      ...(designation !== undefined && { designation }),
      ...(department !== undefined && { department }),
      ...(reportingManagerName !== undefined && { reportingManagerName }),
      ...(reportingManagerDesignation !== undefined && { reportingManagerDesignation }),
    },
  })
  return NextResponse.json({ data: updated })
}
