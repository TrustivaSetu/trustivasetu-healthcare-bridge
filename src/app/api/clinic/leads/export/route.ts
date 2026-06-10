import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import { format, addDays } from 'date-fns'

function fmtDate(d: Date | string | null): string {
  if (!d) return ''
  return format(new Date(d), 'dd/MM/yyyy')
}

function fmtTime(d: Date | string | null): string {
  if (!d) return ''
  return format(new Date(d), 'hh:mm a')
}

function calcFirstEmi(disbursalDate: Date | null, status: string): string {
  if (status !== 'DISBURSED' || !disbursalDate) return ''
  return format(addDays(new Date(disbursalDate), 45), 'dd/MM/yyyy')
}

function tat(from: Date | null, to: Date | null): string {
  if (!from || !to) return ''
  const hours = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 3600000)
  if (hours < 0) return ''
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`
}

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'CLINIC_USER') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const clinicId = session.user.clinicIds[0]
  if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })

  const { searchParams } = new URL(req.url)
  const now = new Date()
  const month = parseInt(searchParams.get('month') ?? String(now.getMonth() + 1))
  const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()))

  if (month < 1 || month > 12 || year < 2020 || year > 2100) {
    return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 })
  }

  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 1)

  const leads = await db.lead.findMany({
    where: { clinicId, applicationDate: { gte: monthStart, lt: monthEnd } },
    select: {
      id: true,
      applicantName: true,
      phone: true,
      email: true,
      amount: true,
      status: true,
      approvedAmount: true,
      disbursedAmount: true,
      applicationDate: true,
      approvalDate: true,
      disbursalDate: true,
      utrNumber: true,
      agreementSigned: true,
      nachStatus: true,
      treatmentName: true,
      treatmentCategory: true,
      rejectionReason: true,
      remarks: true,
      metadata: true,
      lender: { select: { name: true } },
    },
    orderBy: { applicationDate: 'desc' },
  })

  const rows = leads.map((l, i) => {
    const meta = (l.metadata ?? {}) as Record<string, unknown>
    const ca = (meta.currentAddress ?? {}) as Record<string, unknown>
    const address = [ca.houseNo, ca.street, ca.landmark, ca.city, ca.state].filter(Boolean).join(', ')

    return {
      '#': i + 1,
      'Lead ID': l.id.slice(-8).toUpperCase(),
      'Patient Name': l.applicantName,
      'Phone': l.phone ?? '',
      'Email': l.email ?? '',
      'Treatment': l.treatmentName ?? '',
      'Treatment Category': l.treatmentCategory ?? '',
      'Loan Amount (₹L)': l.amount,
      'Status': l.status,
      'Lender': l.lender?.name ?? '',
      'Approved Amount (₹L)': l.approvedAmount ?? '',
      'Disbursed Amount (₹L)': l.disbursedAmount ?? '',
      'UTR Number': l.utrNumber ?? '',
      'Agreement Signed': l.agreementSigned ? 'Yes' : 'No',
      'NACH Status': l.nachStatus ?? '',
      'Application Date': fmtDate(l.applicationDate),
      'Application Time': fmtTime(l.applicationDate),
      'Approval Date': fmtDate(l.approvalDate),
      'Disbursal Date': fmtDate(l.disbursalDate),
      'First EMI Date': calcFirstEmi(l.disbursalDate, l.status),
      'TAT to Approval': tat(l.applicationDate, l.approvalDate),
      'TAT to Disbursal': tat(l.approvalDate, l.disbursalDate),
      'Rejection Reason': l.rejectionReason ?? (l.status === 'REJECTED' ? (l.remarks ?? '') : ''),
      'Remarks': l.remarks ?? '',
      'Address': address,
      'PIN Code': String(ca.pincode ?? (meta.pincode ?? '')),
      'Monthly Income': meta.monthlyIncome ? Number(meta.monthlyIncome) : '',
      'CIBIL Score': meta.cibilScore ? Number(meta.cibilScore) : '',
      'FOIR': meta.foir ? Number(meta.foir) : '',
      'PAN No.': String(meta.panNumber ?? ''),
    }
  })

  const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ '#': '' }])
  const headers = Object.keys(rows[0] ?? { '#': '' })
  const colCount = headers.length
  const rowCount = rows.length

  // Header row: bold, green background, white text
  for (let c = 0; c < colCount; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    if (!ws[addr]) continue
    ws[addr].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
      fill: { patternType: 'solid', fgColor: { rgb: '16A34A' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
    }
  }

  // Data rows: alternating white / light gray
  for (let r = 1; r <= rowCount; r++) {
    const bgRgb = r % 2 === 0 ? 'F9FAFB' : 'FFFFFF'
    for (let c = 0; c < colCount; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      if (!ws[addr]) ws[addr] = { t: 's', v: '' }
      ws[addr].s = { fill: { patternType: 'solid', fgColor: { rgb: bgRgb } } }
    }
  }

  // Freeze first row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 }

  // Auto-fit column widths
  ws['!cols'] = headers.map(h => {
    const maxLen = rows.reduce((mx, row) => {
      const v = row[h as keyof typeof row]
      return Math.max(mx, v != null ? String(v).length : 0)
    }, h.length)
    return { wch: Math.min(Math.max(maxLen + 2, 10), 40) }
  })

  const wb = XLSX.utils.book_new()
  const monthLabel = format(new Date(year, month - 1, 1), 'MMMM-yyyy')
  XLSX.utils.book_append_sheet(wb, ws, 'Leads')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true })
  const filename = `leads-report-${monthLabel}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
