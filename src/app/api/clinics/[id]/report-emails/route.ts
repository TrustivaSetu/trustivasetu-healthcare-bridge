import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({
  reportEmails: z.array(z.string().email()).max(10),
})

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // CLINIC_USER can only access their own clinic
  if (session.user.role === 'CLINIC_USER' && !session.user.clinicIds.includes(params.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const clinic = await db.clinic.findUnique({
    where: { id: params.id },
    select: { id: true, reportEmails: true },
  })
  if (!clinic) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ data: clinic.reportEmails })
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Allow CLINIC_USER or SUPER_ADMIN/ADMIN
  const isSelf = session.user.role === 'CLINIC_USER' && session.user.clinicIds.includes(params.id)
  const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)
  if (!isSelf && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 400 })

  const clinic = await db.clinic.update({
    where: { id: params.id },
    data: { reportEmails: parsed.data.reportEmails },
    select: { id: true, reportEmails: true },
  })

  return NextResponse.json({ data: clinic.reportEmails })
}
