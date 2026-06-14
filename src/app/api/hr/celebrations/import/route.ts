import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { hasPermission } from '@/lib/permissions'
import { db } from '@/lib/db'

interface ImportRow {
  email: string
  dateOfBirth?: string | null
  dateOfJoining?: string | null
  marriageAnniversary?: string | null
}

function parseDate(v: string | null | undefined): Date | null {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

export async function POST(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!hasPermission(session.user.role, 'USER_UPDATE')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let rows: ImportRow[]
  try {
    rows = await req.json()
    if (!Array.isArray(rows)) throw new Error('Expected array')
  } catch {
    return NextResponse.json({ error: 'Body must be a JSON array of {email, dateOfBirth?, dateOfJoining?, marriageAnniversary?}' }, { status: 400 })
  }

  if (rows.length > 500) return NextResponse.json({ error: 'Maximum 500 rows per import' }, { status: 400 })

  const results = { imported: 0, skipped: 0, errors: [] as string[] }

  for (const row of rows) {
    if (!row.email?.trim()) { results.errors.push(`Row missing email`); continue }

    const user = await db.user.findUnique({ where: { email: row.email.toLowerCase().trim() }, select: { id: true } })
    if (!user) { results.errors.push(`${row.email}: user not found`); results.skipped++; continue }

    const dob = parseDate(row.dateOfBirth)
    const doj = parseDate(row.dateOfJoining)
    const ann = parseDate(row.marriageAnniversary)

    if (!dob && !doj && !ann) { results.skipped++; continue }

    const update: Record<string, Date | null> = {}
    if (row.dateOfBirth !== undefined) update.dateOfBirth = dob
    if (row.dateOfJoining !== undefined) update.dateOfJoining = doj
    if (row.marriageAnniversary !== undefined) update.marriageAnniversary = ann

    await db.employeeProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...update },
      update,
    })
    results.imported++
  }

  await db.auditLog.create({
    data: {
      userId: session.user.id,
      action: 'IMPORT',
      entity: 'EmployeeProfile',
      details: `Celebration dates bulk import: ${results.imported} imported, ${results.skipped} skipped, ${results.errors.length} errors`,
    },
  })

  return NextResponse.json(results)
}

// Download CSV template
export async function GET() {
  const csv = [
    'email,dateOfBirth,dateOfJoining,marriageAnniversary',
    'john.doe@trustivasetu.com,1990-05-15,2022-01-10,2018-11-20',
    'jane.smith@trustivasetu.com,1988-08-22,2021-06-01,',
  ].join('\n')

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="celebration-dates-template.csv"',
    },
  })
}
