import { NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'

export async function GET() {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const today = new Date()
  const todayMonth = today.getUTCMonth() + 1
  const todayDay = today.getUTCDate()

  const profiles = await db.employeeProfile.findMany({
    where: {
      OR: [
        { dateOfBirth: { not: null } },
        { dateOfJoining: { not: null } },
        { marriageAnniversary: { not: null } },
      ],
    },
    include: { user: { select: { id: true, name: true, isActive: true } } },
  })

  const celebrations: Array<{ type: 'birthday' | 'work_anniversary' | 'marriage_anniversary'; userId: string; name: string }> = []

  for (const p of profiles) {
    if (!p.user.isActive) continue

    if (p.dateOfBirth) {
      const d = new Date(p.dateOfBirth)
      if (d.getUTCMonth() + 1 === todayMonth && d.getUTCDate() === todayDay)
        celebrations.push({ type: 'birthday', userId: p.user.id, name: p.user.name })
    }
    if (p.dateOfJoining) {
      const d = new Date(p.dateOfJoining)
      if (d.getUTCMonth() + 1 === todayMonth && d.getUTCDate() === todayDay)
        celebrations.push({ type: 'work_anniversary', userId: p.user.id, name: p.user.name })
    }
    if (p.marriageAnniversary) {
      const d = new Date(p.marriageAnniversary)
      if (d.getUTCMonth() + 1 === todayMonth && d.getUTCDate() === todayDay)
        celebrations.push({ type: 'marriage_anniversary', userId: p.user.id, name: p.user.name })
    }
  }

  return NextResponse.json({ data: celebrations })
}
