/**
 * Monthly clinic report PDF generator.
 * Called from /api/clinic/report when format=pdf.
 */
import React from 'react'
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { format } from 'date-fns'

const N = '#07111f'   // navy
const L = '#bef264'   // lime
const SL = '#64748b'  // slate
const LT = '#f8fafc'  // light bg
const BD = '#e2e8f0'  // border
const W  = '#ffffff'

const STATUS_COLOR: Record<string, string> = {
  DISBURSED: '#16a34a',
  APPROVED:  '#2563eb',
  PENDING:   '#d97706',
  DOCS_PENDING: '#d97706',
  REJECTED:  '#dc2626',
  CANCELLED: '#94a3b8',
}

const s = StyleSheet.create({
  page:        { backgroundColor: W, fontFamily: 'Helvetica', fontSize: 9, color: '#1e293b', paddingBottom: 36 },
  header:      { backgroundColor: N, paddingHorizontal: 28, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logoBox:     { width: 22, height: 22, backgroundColor: L, borderRadius: 4, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  logoTxt:     { color: N, fontFamily: 'Helvetica-Bold', fontSize: 13 },
  brandCol:    { flexDirection: 'row', alignItems: 'center' },
  brandName:   { color: W, fontFamily: 'Helvetica-Bold', fontSize: 13 },
  brandSub:    { color: L, fontSize: 7, marginTop: 1 },
  hRight:      { alignItems: 'flex-end' },
  hRightLbl:   { color: '#94a3b8', fontSize: 7 },
  hRightVal:   { color: W, fontFamily: 'Helvetica-Bold', fontSize: 10, marginTop: 1 },

  meta:        { backgroundColor: LT, borderBottomWidth: 1, borderBottomColor: BD, paddingHorizontal: 28, paddingVertical: 8, flexDirection: 'row', gap: 24 },
  metaLbl:     { color: SL, fontSize: 7, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaVal:     { color: N, fontFamily: 'Helvetica-Bold', fontSize: 9, marginTop: 1 },

  body:        { paddingHorizontal: 28, paddingTop: 16 },

  cards:       { flexDirection: 'row', gap: 7, marginBottom: 16 },
  card:        { flex: 1, backgroundColor: LT, borderWidth: 1, borderColor: BD, borderRadius: 5, padding: 9 },
  cardLbl:     { color: SL, fontSize: 7, textTransform: 'uppercase', letterSpacing: 0.4 },
  cardVal:     { color: N, fontFamily: 'Helvetica-Bold', fontSize: 15, marginTop: 2 },
  cardSub:     { color: SL, fontSize: 7, marginTop: 2 },

  secTitle:    { fontFamily: 'Helvetica-Bold', fontSize: 8, color: N, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: BD },
  sec:         { marginBottom: 16 },

  tbl:         { borderWidth: 1, borderColor: BD, borderRadius: 3, overflow: 'hidden' },
  tHead:       { flexDirection: 'row', backgroundColor: N, paddingVertical: 5, paddingHorizontal: 7 },
  tHCell:      { color: L, fontFamily: 'Helvetica-Bold', fontSize: 7, textTransform: 'uppercase', letterSpacing: 0.3 },
  tRow:        { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 7, borderBottomWidth: 1, borderBottomColor: BD },
  tRowAlt:     { backgroundColor: LT },
  tCell:       { fontSize: 8, color: '#334155' },
  tCellBold:   { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1e293b' },

  footer:      { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 1, borderTopColor: BD, paddingHorizontal: 28, paddingVertical: 7, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: W },
  footerTxt:   { color: '#94a3b8', fontSize: 7 },
  footerBrand: { color: N, fontFamily: 'Helvetica-Bold', fontSize: 7 },

  emptyTxt:    { color: SL, fontSize: 8, textAlign: 'center', padding: 12 },
})

// ── Column definitions ────────────────────────────────────────────────────────
const LEAD_COLS = [
  { label: '#',           width: '5%'  },
  { label: 'Patient Name',width: '22%' },
  { label: 'Applied ₹L',  width: '10%' },
  { label: 'Status',      width: '12%' },
  { label: 'Approved ₹L', width: '10%' },
  { label: 'Disbursed ₹L',width: '11%' },
  { label: 'Lender',      width: '14%' },
  { label: 'Appl. Date',  width: '10%' },
  { label: 'Disb. Date',  width: '10%' },
]

const DISB_COLS = [
  { label: '#',           width: '5%'  },
  { label: 'Patient Name',width: '25%' },
  { label: 'Disbursed ₹L',width: '14%' },
  { label: 'UTR Number',  width: '18%' },
  { label: 'Lender',      width: '18%' },
  { label: 'Appl. Date',  width: '10%' },
  { label: 'Disb. Date',  width: '10%' },
]

// ── Types ─────────────────────────────────────────────────────────────────────
interface Lead {
  id: string
  applicantName: string
  phone: string | null
  amount: number
  status: string
  approvedAmount: number | null
  disbursedAmount: number | null
  disbursalDate: Date | null
  applicationDate: Date
  utrNumber: string | null
  remarks: string | null
  lender: { name: string } | null
  approvalDate: Date | null
}

interface ClinicInfo {
  name: string
  contactPerson: string
  contactNumber: string
  email: string | null
}

interface ReportData {
  clinic: ClinicInfo
  leads: Lead[]
  disbursals: Lead[]
  periodLabel: string
  totalLeads: number
  approved: number
  disbursed: number
  pending: number
  rejected: number
  totalAppliedValue: number
  totalDisbursedValue: number
  approvalRate: string
  disbursalRate: string
}

// ── PDF Document component ────────────────────────────────────────────────────
function ClinicReportPDF({ d }: { d: ReportData }) {
  const generatedOn = format(new Date(), 'dd/MM/yyyy HH:mm')

  return (
    <Document title={`Clinic Report — ${d.clinic.name} — ${d.periodLabel}`} author="Trustiva Setu">
      <Page size="A4" orientation="landscape" style={s.page}>

        {/* Header */}
        <View style={s.header}>
          <View style={s.brandCol}>
            <View style={s.logoBox}><Text style={s.logoTxt}>T</Text></View>
            <View>
              <Text style={s.brandName}>Trustiva Setu</Text>
              <Text style={s.brandSub}>Clinic Portal</Text>
            </View>
          </View>
          <View style={s.hRight}>
            <Text style={s.hRightLbl}>MONTHLY REPORT</Text>
            <Text style={s.hRightVal}>{d.periodLabel}</Text>
          </View>
        </View>

        {/* Meta strip */}
        <View style={s.meta}>
          <View><Text style={s.metaLbl}>Clinic</Text><Text style={s.metaVal}>{d.clinic.name}</Text></View>
          <View><Text style={s.metaLbl}>Contact</Text><Text style={s.metaVal}>{d.clinic.contactPerson}</Text></View>
          <View><Text style={s.metaLbl}>Email</Text><Text style={s.metaVal}>{d.clinic.email ?? '—'}</Text></View>
          <View><Text style={s.metaLbl}>Generated</Text><Text style={s.metaVal}>{generatedOn}</Text></View>
        </View>

        <View style={s.body}>
          {/* Summary cards */}
          <View style={s.cards}>
            <View style={s.card}>
              <Text style={s.cardLbl}>Total Leads</Text>
              <Text style={s.cardVal}>{d.totalLeads}</Text>
              <Text style={s.cardSub}>submitted this period</Text>
            </View>
            <View style={s.card}>
              <Text style={s.cardLbl}>Approved / Disbursed</Text>
              <Text style={s.cardVal}>{d.approved}</Text>
              <Text style={s.cardSub}>approval rate {d.approvalRate}%</Text>
            </View>
            <View style={s.card}>
              <Text style={s.cardLbl}>Disbursed</Text>
              <Text style={s.cardVal}>{d.disbursed}</Text>
              <Text style={s.cardSub}>disbursal rate {d.disbursalRate}%</Text>
            </View>
            <View style={s.card}>
              <Text style={s.cardLbl}>Pending</Text>
              <Text style={s.cardVal}>{d.pending}</Text>
              <Text style={s.cardSub}>under review</Text>
            </View>
            <View style={s.card}>
              <Text style={s.cardLbl}>Total Applied (₹L)</Text>
              <Text style={s.cardVal}>{d.totalAppliedValue.toFixed(1)}</Text>
              <Text style={s.cardSub}>lakh rupees</Text>
            </View>
            <View style={s.card}>
              <Text style={s.cardLbl}>Total Disbursed (₹L)</Text>
              <Text style={[s.cardVal, { color: '#16a34a' }]}>{d.totalDisbursedValue.toFixed(1)}</Text>
              <Text style={s.cardSub}>lakh rupees</Text>
            </View>
          </View>

          {/* Leads table */}
          <View style={s.sec}>
            <Text style={s.secTitle}>All Leads — {d.periodLabel}</Text>
            <View style={s.tbl}>
              <View style={s.tHead}>
                {LEAD_COLS.map(c => (
                  <Text key={c.label} style={[s.tHCell, { width: c.width }]}>{c.label}</Text>
                ))}
              </View>
              {d.leads.length === 0 ? (
                <Text style={s.emptyTxt}>No leads in this period</Text>
              ) : d.leads.map((l, i) => (
                <View key={l.id} style={[s.tRow, i % 2 === 1 ? s.tRowAlt : {}]} wrap={false}>
                  <Text style={[s.tCell, { width: '5%' }]}>{i + 1}</Text>
                  <Text style={[s.tCellBold, { width: '22%' }]}>{l.applicantName}</Text>
                  <Text style={[s.tCell, { width: '10%' }]}>{l.amount.toFixed(1)}</Text>
                  <Text style={[s.tCell, { width: '12%', color: STATUS_COLOR[l.status] ?? SL }]}>{l.status}</Text>
                  <Text style={[s.tCell, { width: '10%' }]}>{l.approvedAmount != null ? l.approvedAmount.toFixed(1) : '—'}</Text>
                  <Text style={[s.tCell, { width: '11%', color: l.disbursedAmount ? '#16a34a' : '#334155' }]}>{l.disbursedAmount != null ? l.disbursedAmount.toFixed(1) : '—'}</Text>
                  <Text style={[s.tCell, { width: '14%' }]}>{l.lender?.name ?? '—'}</Text>
                  <Text style={[s.tCell, { width: '10%' }]}>{format(new Date(l.applicationDate), 'dd/MM/yy')}</Text>
                  <Text style={[s.tCell, { width: '10%' }]}>{l.disbursalDate ? format(new Date(l.disbursalDate), 'dd/MM/yy') : '—'}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Disbursals table */}
          <View style={s.sec}>
            <Text style={s.secTitle}>Disbursals — {d.periodLabel}</Text>
            <View style={s.tbl}>
              <View style={s.tHead}>
                {DISB_COLS.map(c => (
                  <Text key={c.label} style={[s.tHCell, { width: c.width }]}>{c.label}</Text>
                ))}
              </View>
              {d.disbursals.length === 0 ? (
                <Text style={s.emptyTxt}>No disbursals in this period</Text>
              ) : d.disbursals.map((d2, i) => (
                <View key={d2.id} style={[s.tRow, i % 2 === 1 ? s.tRowAlt : {}]} wrap={false}>
                  <Text style={[s.tCell, { width: '5%' }]}>{i + 1}</Text>
                  <Text style={[s.tCellBold, { width: '25%' }]}>{d2.applicantName}</Text>
                  <Text style={[s.tCell, { width: '14%', color: '#16a34a', fontFamily: 'Helvetica-Bold' }]}>{d2.disbursedAmount != null ? d2.disbursedAmount.toFixed(1) : '—'}</Text>
                  <Text style={[s.tCell, { width: '18%' }]}>{d2.utrNumber ?? '—'}</Text>
                  <Text style={[s.tCell, { width: '18%' }]}>{d2.lender?.name ?? '—'}</Text>
                  <Text style={[s.tCell, { width: '10%' }]}>{format(new Date(d2.applicationDate), 'dd/MM/yy')}</Text>
                  <Text style={[s.tCell, { width: '10%' }]}>{d2.disbursalDate ? format(new Date(d2.disbursalDate), 'dd/MM/yy') : '—'}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerTxt}>Confidential — {d.clinic.name} — {d.periodLabel}</Text>
          <Text style={s.footerBrand}>Trustiva Setu LMS</Text>
          <Text style={s.footerTxt} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}

// ── Public API ────────────────────────────────────────────────────────────────
export async function generateClinicReportPdf(data: ReportData): Promise<Buffer> {
  return renderToBuffer(<ClinicReportPDF d={data} />) as Promise<Buffer>
}
