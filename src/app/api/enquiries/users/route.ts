import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { role, id: userId } = session.user

  try {
    if (role === 'TEAM_MEMBER') {
      const user = await db.user.findUnique({
        where: { id: userId },
        include: {
          regionAssignments: { include: { region: true } },
          reportingManager: { select: { id: true, name: true } },
        },
      })
      if (!user) return NextResponse.json({ data: [] })
      return NextResponse.json({
        data: [
          {
            id: user.id,
            name: user.name,
            email: user.email,
            regionName: user.regionAssignments[0]?.region?.name ?? null,
            managerId: user.reportingManagerId ?? null,
            managerName: user.reportingManager?.name ?? null,
          },
        ],
      })
    }

    let where: Record<string, unknown> = { role: 'TEAM_MEMBER', isActive: true }

    if (role === 'REGIONAL_MANAGER') {
      where = { ...where, reportingManagerId: userId }
    }

    const users = await db.user.findMany({
      where,
      include: {
        regionAssignments: { include: { region: true } },
        reportingManager: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    })

    const data = users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      regionName: u.regionAssignments[0]?.region?.name ?? null,
      managerId: u.reportingManagerId ?? null,
      managerName: u.reportingManager?.name ?? null,
    }))

    return NextResponse.json({ data })
  } catch (e) {
    console.error('[GET /api/enquiries/users]', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
