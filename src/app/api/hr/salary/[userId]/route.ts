import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { calculateSalary } from '@/lib/hr/salary'
import { z } from 'zod'

function isAdmin(role: string) {
  return role === 'SUPER_ADMIN' || role === 'ADMIN'
}

export async function GET(req: NextRequest, { params }: { params: { userId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const salary = await db.salaryStructure.findUnique({ where: { userId: params.userId } })
  if (!salary) return NextResponse.json({ data: null })

  return NextResponse.json({ data: { ...salary, components: calculateSalary(salary.grossSalary, salary.tds) } })
}

export async function PUT(req: NextRequest, { params }: { params: { userId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdmin(session.user.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const parsed = z.object({ grossSalary: z.number().positive(), tds: z.number().min(0).optional() }).safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid salary data' }, { status: 400 })

  const { grossSalary, tds = 0 } = parsed.data
  const salary = await db.salaryStructure.upsert({
    where: { userId: params.userId },
    create: { userId: params.userId, grossSalary, tds },
    update: { grossSalary, tds },
  })

  await db.auditLog.create({
    data: { userId: session.user.id, action: 'UPDATE', entity: 'SalaryStructure', entityId: params.userId },
  })

  return NextResponse.json({ data: { ...salary, components: calculateSalary(grossSalary, tds) } })
}
