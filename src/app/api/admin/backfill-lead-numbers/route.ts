import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'

// One-time endpoint: assign sequential leadNumbers to all leads that have null.
// Ordered by createdAt so oldest leads get the lowest numbers.
// Safe to call multiple times (only updates leads where leadNumber IS NULL).
export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['SUPER_ADMIN', 'ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Find all leads without a leadNumber, ordered by creation time
  const unNumbered = await db.lead.findMany({
    where: { leadNumber: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, createdAt: true },
  })

  if (unNumbered.length === 0) {
    return NextResponse.json({ message: 'All leads already have lead numbers', updated: 0 })
  }

  // Get the current max leadNumber to continue from there
  const maxResult = await db.lead.aggregate({ _max: { leadNumber: true } })
  let counter = maxResult._max.leadNumber ?? 0

  // Assign numbers sequentially
  const updates = unNumbered.map(lead => {
    counter += 1
    return db.lead.update({
      where: { id: lead.id },
      data: { leadNumber: counter },
    })
  })

  await db.$transaction(updates)

  return NextResponse.json({
    message: `Assigned lead numbers to ${unNumbered.length} leads`,
    updated: unNumbered.length,
    range: { from: (maxResult._max.leadNumber ?? 0) + 1, to: counter },
  })
}
