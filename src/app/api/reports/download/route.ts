import { NextRequest, NextResponse } from 'next/server'
import { getRequestSession } from '@/lib/api-auth'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import { buildClinicFilter } from '@/lib/permissions'
import { checkRolePermission } from '@/lib/role-permissions'

function getDateRange(preset: string, from?: string, to?: string) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  switch (preset) {
    case 'today':
      return { gte: today }
    case 'week': {
      const day = today.getDay()
      const start = new Date(today)
      start.setDate(today.getDate() - day)
      return { gte: start }
    }
    case 'month':
      return { gte: new Date(now.getFullYear(), now.getMonth(), 1) }
    case 'last_month': {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const e = new Date(now.getFullYear(), now.getMonth(), 0)
      return { gte: s, lte: e }
    }
    case 'last_3_months':
      return { gte: new Date(now.getFullYear(), now.getMonth() - 3, 1) }
    case 'last_6_months':
      return { gte: new Date(now.getFullYear(), now.getMonth() - 6, 1) }
    case 'year':
      return { gte: new Date(now.getFullYear(), 0, 1) }
    case 'custom':
      return {
        gte: from ? new Date(from) : undefined,
        lte: to ? new Date(to) : undefined,
      }
    default:
      return undefined
  }
}

function fmt(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (val instanceof Date) return val.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  if (typeof val === 'number') return String(val)
  return String(val)
}

function fmtDt(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (val instanceof Date) return val.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' })
  return String(val)
}

function fmtLeadId(leadNumber: number | null | undefined, fallbackId?: string): string {
  if (leadNumber) return `TS-${leadNumber.toString().padStart(6, '0')}`
  if (fallbackId) return fallbackId.slice(-8).toUpperCase()
  return ''
}

function fmtAppId(applicationNumber: number | null | undefined): string {
  if (!applicationNumber) return ''
  return `APP-${applicationNumber.toString().padStart(6, '0')}`
}

function toSheet(data: Record<string, unknown>[]): XLSX.WorkSheet {
  return XLSX.utils.json_to_sheet(data)
}

export async function GET(req: NextRequest) {
  const session = await getRequestSession()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!await checkRolePermission(session.user.role as string, 'REPORTS', 'VIEW')) {
    return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? 'clinics'
  const datePreset = searchParams.get('datePreset') ?? 'all'
  const from = searchParams.get('from') ?? undefined
  const to = searchParams.get('to') ?? undefined
  const format = searchParams.get('format') ?? 'xlsx'

  const dateFilter = getDateRange(datePreset, from, to)
  const { role, regionIds, clinicIds } = session.user
  const clinicFilter = buildClinicFilter(role, regionIds ?? [], clinicIds ?? [])

  const wb = XLSX.utils.book_new()
  let filename = `trustiva-${type}`

  try {
    if (type === 'clinics') {
      const clinics = await db.clinic.findMany({
        where: { ...clinicFilter, isActive: true },
        include: {
          region: true,
          assignedRM: { select: { name: true, phone: true } },
          _count: { select: { leads: true } },
        },
        orderBy: { name: 'asc' },
      })

      const rows = clinics.map(c => {
        const meta = (c.metadata ?? {}) as Record<string, unknown>
        return {
          'Clinic Code': fmt(c.externalId),
          'Clinic Name': fmt(c.name),
          'Hospital Type': fmt(c.hospitalType),
          'Region': fmt(c.region?.name),
          'Assigned RM': fmt(c.assignedRM?.name),
          'RM Phone': fmt(c.assignedRM?.phone),
          'Contact Person': fmt(c.contactPerson),
          'Contact Number': fmt(c.contactNumber),
          'Email': fmt(c.email),
          'Address': fmt(c.address),
          'Pincode': fmt(meta.pincode),
          'GST Number': fmt(meta.gstNumber),
          'PAN Number': fmt(meta.panNumber),
          'Account Number': fmt(c.accountNumber || meta.accountNumber),
          'IFSC Code': fmt(meta.ifscCode),
          'Bank Name': fmt(meta.bankName),
          'Signing Authority': fmt(meta.signingAuthority),
          'Business Potential (L)': fmt(c.businessPotential),
          'Agreement URL': fmt(meta.agreementUrl),
          'Legal Entity': fmt(meta.legalEntityName),
          'Udyam Number': fmt(meta.udyamNumber),
          'Total Leads': c._count.leads,
          'Onboarded Date': fmt(c.onboardedAt),
          'Status': c.isActive ? 'Active' : 'Inactive',
        }
      })

      const ws = toSheet(rows)
      ws['!cols'] = Object.keys(rows[0] ?? {}).map(() => ({ wch: 22 }))
      XLSX.utils.book_append_sheet(wb, ws, 'Clinics')
      filename = 'trustiva-clinic-master'
    }

    else if (type === 'schemes') {
      const clinicsWithSchemes = await db.clinic.findMany({
        where: { ...clinicFilter, isActive: true },
        include: {
          region: true,
          schemes: {
            where: { isActive: true },
            include: { schemeTemplate: true },
          },
        },
        orderBy: { name: 'asc' },
      })

      type ClinicWithSchemes = typeof clinicsWithSchemes[number]
      type SchemeEntry = ClinicWithSchemes['schemes'][number]
      const rows = clinicsWithSchemes.flatMap((c: ClinicWithSchemes) =>
        c.schemes.map((s: SchemeEntry) => ({
          'Clinic Code': fmt(c.externalId),
          'Clinic Name': fmt(c.name),
          'Region': fmt(c.region?.name),
          'Scheme': fmt(s.schemeTemplate.name),
          'Tenure (months)': s.schemeTemplate.tenure,
          'Advance EMI': s.schemeTemplate.advanceEmi,
          'Balance EMI': s.schemeTemplate.balanceEmi,
          'Hospital Subvention %': s.hospitalSubventionPct,
          'Subvention GST Type': s.subventionGstType,
          'GST on Subvention %': s.gstOnSubvention,
          'Total Subvention % (to Lender)': parseFloat(s.totalSubventionPct.toFixed(4)),
          'Processing Fee %': s.processingFeePct,
          'PF GST Type': s.processingFeeGstType,
          'GST on PF %': s.gstOnPF,
          'Total PF % (Customer pays)': parseFloat((
            s.processingFeeGstType === 'EXCLUDED'
              ? s.processingFeePct * 1.18
              : s.processingFeePct
          ).toFixed(4)),
          'Agreed Date': fmt(s.agreedAt),
        }))
      )

      const ws = toSheet(rows.length ? rows : [{ 'Message': 'No schemes found' }])
      ws['!cols'] = Object.keys(rows[0] ?? {}).map(() => ({ wch: 22 }))
      XLSX.utils.book_append_sheet(wb, ws, 'Clinic Schemes')
      filename = 'trustiva-clinic-schemes'
    }

    else if (type === 'leads') {
      const where: Record<string, unknown> = { clinic: clinicFilter }
      if (dateFilter) where.applicationDate = dateFilter

      const leads = await db.lead.findMany({
        where,
        include: {
          clinic: { include: { region: true, assignedRM: { select: { name: true } } } },
          lender: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { applicationDate: 'desc' },
      })

      const rows = leads.map(l => {
        const meta = (l.metadata ?? {}) as Record<string, unknown>
        return {
          'Lead ID': fmtLeadId(l.leadNumber, l.id),
          'Application ID': fmtAppId(l.applicationNumber),
          'Patient Name': fmt(l.applicantName),
          'Phone': fmt(l.phone),
          'Email': fmt(l.email),
          'Channel Partner': fmt(l.clinic?.name),
          'Channel Partner Code': fmt(l.clinic?.externalId),
          'Region': fmt(l.clinic?.region?.name),
          'RM Name': fmt(l.clinic?.assignedRM?.name),
          'Treatment Category': fmt(meta.treatmentCategory ?? l.treatmentCategory),
          'Treatment Name': fmt(l.treatmentName),
          'Employment Type': fmt(meta.employmentType),
          'Monthly Income': fmt(meta.monthlyIncome),
          'PAN': fmt(meta.panNumber),
          'Pincode': fmt(meta.pincode),
          'Loan Amount': l.amount,
          'Approved Amount': fmt(l.approvedAmount),
          'Disbursed Amount': fmt(l.disbursedAmount),
          'Status': ({
            PENDING: 'Pending', DOCS_PENDING: 'Docs Pending', KYC_PENDING: 'KYC Pending',
            KYC_APPROVED: 'KYC Approved', MARKUP_PENDING: 'Markup Pending', PROCESSING: 'Processing',
            APPROVED: 'Approved', DISBURSED: 'Disbursed', REJECTED: 'Rejected', CANCELLED: 'Cancelled',
          }[l.status] ?? l.status),
          'Agreement Signed': l.agreementSigned ? 'Yes' : 'No',
          'NACH Done': l.nachStatus === 'DONE' ? 'Yes' : 'No',
          'UTR Number': fmt(l.utrNumber),
          'Lender': fmt(l.lender?.name),
          'Scheme Type': fmt(meta.schemeType),
          'Tenure': fmt(meta.tenure),
          'EMI': fmt(meta.emi),
          'Processing Fee %': fmt(meta.processingFeePct),
          'Processing Fee Amt': fmt(meta.processingFeeAmount),
          'Downpayment': fmt(meta.downPayment),
          'Lead Created': fmtDt(l.createdAt),
          'Application Date': fmtDt(l.applicationDate),
          'Application Created': fmtDt(l.applicationCreatedAt),
          'Approval Date': fmt(l.approvalDate),
          'Disbursal Date': fmtDt(l.disbursalDate),
          'Rejection Reason': fmt(l.rejectionReason ?? (l.status === 'REJECTED' ? l.remarks : null)),
          'Remarks': fmt(l.remarks),
          'Created By': fmt(l.createdBy?.name),
        }
      })

      const ws = toSheet(rows.length ? rows : [{ 'Message': 'No leads found' }])
      ws['!cols'] = Object.keys(rows[0] ?? {}).map(() => ({ wch: 20 }))
      XLSX.utils.book_append_sheet(wb, ws, 'Leads')
      filename = 'trustiva-leads-report'
    }

    else if (type === 'disbursals') {
      const where: Record<string, unknown> = { status: 'DISBURSED', clinic: clinicFilter }
      if (dateFilter) where.disbursalDate = dateFilter

      const leads = await db.lead.findMany({
        where,
        include: {
          clinic: { include: { region: true, assignedRM: { select: { name: true } } } },
          lender: { select: { name: true } },
        },
        orderBy: { disbursalDate: 'desc' },
      })

      const rows = leads.map(l => {
        const meta = (l.metadata ?? {}) as Record<string, unknown>
        return {
          'Lead ID': fmtLeadId(l.leadNumber, l.id),
          'Application ID': fmtAppId(l.applicationNumber),
          'Patient Name': fmt(l.applicantName),
          'Phone': fmt(l.phone),
          'Channel Partner': fmt(l.clinic?.name),
          'Channel Partner Code': fmt(l.clinic?.externalId),
          'Region': fmt(l.clinic?.region?.name),
          'RM Name': fmt(l.clinic?.assignedRM?.name),
          'Lender': fmt(l.lender?.name),
          'Loan Amount': l.amount,
          'Disbursed Amount': l.disbursedAmount ?? 0,
          'EMI': fmt(meta.emi),
          'Tenure': fmt(meta.tenure),
          'Scheme': fmt(meta.schemeType),
          'Processing Fee %': fmt(meta.processingFeePct),
          'Processing Fee Amt': fmt(meta.processingFeeAmount),
          'Downpayment': fmt(meta.downPayment),
          'Treatment': fmt(l.treatmentName),
          'Application Date': fmtDt(l.applicationDate),
          'Disbursal Date': fmtDt(l.disbursalDate),
        }
      })

      const ws = toSheet(rows.length ? rows : [{ 'Message': 'No disbursals found' }])
      ws['!cols'] = Object.keys(rows[0] ?? {}).map(() => ({ wch: 20 }))
      XLSX.utils.book_append_sheet(wb, ws, 'Disbursals')
      filename = 'trustiva-disbursal-report'
    }

    else if (type === 'lenders') {
      const lenders = await db.lender.findMany({
        include: { _count: { select: { leads: true } } },
        orderBy: { name: 'asc' },
      })

      const rows = await Promise.all(lenders.map(async l => {
        const meta = (l.metadata ?? {}) as Record<string, unknown>
        const disbAgg = await db.lead.aggregate({
          where: { lenderId: l.id, status: 'DISBURSED' },
          _sum: { disbursedAmount: true },
          _count: true,
        })
        const approvedCount = await db.lead.count({ where: { lenderId: l.id, status: 'APPROVED' } })

        return {
          'Lender Name': fmt(l.name),
          'Lender Code': fmt(l.code),
          'Status': l.isActive ? 'Active' : 'Inactive',
          'API Configured': meta.apiUrl ? 'Yes' : 'No',
          'API URL': fmt(meta.apiUrl),
          'Webhook Status URL': `https://lms.trustivasetu.com/api/webhooks/lenders/${l.id}/status`,
          'Webhook Disbursal URL': `https://lms.trustivasetu.com/api/webhooks/lenders/${l.id}/disbursal`,
          'Total Leads': l._count.leads,
          'Approved Leads': approvedCount,
          'Disbursed Leads': disbAgg._count,
          'Total Disbursed (Rs)': disbAgg._sum.disbursedAmount ?? 0,
        }
      }))

      const ws = toSheet(rows)
      ws['!cols'] = Object.keys(rows[0] ?? {}).map(() => ({ wch: 25 }))
      XLSX.utils.book_append_sheet(wb, ws, 'Lenders')
      filename = 'trustiva-lender-report'
    }

    // Generate file
    const ext = format === 'csv' ? 'csv' : 'xlsx'
    const bookType = format === 'csv' ? 'csv' : 'xlsx'
    const buf = XLSX.write(wb, { type: 'buffer', bookType: bookType as XLSX.BookType })
    const mimeType = format === 'csv'
      ? 'text/csv'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

    return new NextResponse(buf, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}-${new Date().toISOString().split('T')[0]}.${ext}"`,
      },
    })
  } catch (e) {
    console.error('Report error:', e)
    return NextResponse.json({ error: 'Report generation failed' }, { status: 500 })
  }
}