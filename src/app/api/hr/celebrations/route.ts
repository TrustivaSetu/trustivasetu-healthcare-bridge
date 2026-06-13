import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'

// Get current IST date components (IST = UTC+5:30)
function getISTToday(): { year: number; month: number; day: number } {
  const now = new Date()
  const ist = new Date(now.getTime() + (5 * 60 + 30) * 60 * 1000)
  return { year: ist.getUTCFullYear(), month: ist.getUTCMonth() + 1, day: ist.getUTCDate() }
}

// Days until next occurrence of this month/day (0 = today, 1 = tomorrow …)
function daysUntilNext(storedDate: Date, today: { year: number; month: number; day: number }): number {
  const d = new Date(storedDate)
  const m = d.getUTCMonth() + 1
  const dd = d.getUTCDate()
  const thisOcc = new Date(today.year, m - 1, dd)
  const todayObj = new Date(today.year, today.month - 1, today.day)
  let diff = Math.floor((thisOcc.getTime() - todayObj.getTime()) / 86400000)
  if (diff < 0) {
    const nextOcc = new Date(today.year + 1, m - 1, dd)
    diff = Math.floor((nextOcc.getTime() - todayObj.getTime()) / 86400000)
  }
  return diff
}

function completedYears(storedDate: Date, currentYear: number): number {
  return currentYear - new Date(storedDate).getUTCFullYear()
}

type CelebType = 'birthday' | 'work_anniversary' | 'marriage_anniversary'

interface Celebration {
  type: CelebType
  userId: string
  name: string
  daysFromNow: number
  isToday: boolean
  yearsCount?: number
}

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const upcomingDays = Math.min(parseInt(searchParams.get('upcoming') ?? '30'), 90)

  const today = getISTToday()

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

  const celebrations: Celebration[] = []

  for (const p of profiles) {
    if (!p.user.isActive) continue

    const push = (date: Date | null, type: CelebType) => {
      if (!date) return
      const days = daysUntilNext(date, today)
      if (days > upcomingDays) return
      const yrs = type !== 'birthday' ? completedYears(date, today.year) : undefined
      celebrations.push({
        type,
        userId: p.user.id,
        name: p.user.name,
        daysFromNow: days,
        isToday: days === 0,
        yearsCount: yrs && yrs > 0 ? yrs : undefined,
      })
    }

    push(p.dateOfBirth, 'birthday')
    push(p.dateOfJoining, 'work_anniversary')
    push(p.marriageAnniversary, 'marriage_anniversary')
  }

  celebrations.sort((a, b) => a.daysFromNow - b.daysFromNow)

  return NextResponse.json({
    data: celebrations,
    todayCount: celebrations.filter(c => c.isToday).length,
    myCelebrations: celebrations.filter(c => c.userId === session.user.id && c.isToday),
  })
}
