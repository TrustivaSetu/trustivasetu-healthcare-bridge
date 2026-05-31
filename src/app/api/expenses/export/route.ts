import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import { format } from 'date-fns'
import { getCategoryLabel } from '@/lib/hr/expenses'

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId')
  const month = searchParams.get('month')
  const expenseId = searchParams.get('expenseId')

  const isAdmin = session.user.role === 'SUPER_ADMIN' || session.user.role === 'ADMIN'

  const where: Record<string, unknown> = {}
  if (expenseId) where.id = expenseId
  else {
    where.userId = userId && isAdmin ? userId : session.user.id
    if (month) {
      const [y, m] = month.split('-').map(Number)
      where.periodStart = { gte: new Date(Date.UTC(y, m - 1, 1)) }
    }
  }

  const expenses = await db.expense.findMany({
    where,
    include: {
      user: { select: { name: true, employeeProfile: { select: { designation: true } } } },
      items: { orderBy: { date: 'asc' } },
    },
    orderBy: { periodStart: 'asc' },
  })

  const rows: Record<string, unknown>[] = []
  for (const exp of expenses) {
    for (const item of exp.items) {
      rows.push({
        'Employee': exp.user.name,
        'Designation': exp.user.employeeProfile?.designation ?? '',
        'Expense Title': exp.title,
        'Period': `${format(new Date(exp.periodStart), 'dd MMM yyyy')} – ${format(new Date(exp.periodEnd), 'dd MMM yyyy')}`,
        'Status': exp.status,
        'Date': format(new Date(item.date), 'dd-MMM-yyyy'),
        'Category': getCategoryLabel(item.category),
        'Description': item.description,
        'From Location': item.fromLocation ?? '',
        'To Location': item.toLocation ?? '',
        'Distance (km)': item.distanceKm ?? '',
        'Amount (₹)': item.amount,
        'Bill Attached': item.billUrl ? 'Yes' : 'No',
        'Client Name': item.clientName ?? '',
      })
    }
  }

  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [14, 20, 20, 22, 12, 14, 22, 24, 16, 16, 12, 12, 12, 16].map(w => ({ wch: w }))
  XLSX.utils.book_append_sheet(wb, ws, 'Expenses')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const filename = expenseId ? `Expense_${expenseId.slice(-6)}.xlsx` : `Expenses_${month ?? 'All'}.xlsx`

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
