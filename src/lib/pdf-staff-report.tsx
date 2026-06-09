/**
 * Staff report PDF generator.
 * Called from /api/clinic/staff/report when format=pdf.
 */
import React from 'react'
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { format } from 'date-fns'

const N = '#07111f'
const L = '#bef264'
const SL = '#64748b'
const LT = '#f8fafc'
const BD = '#e2e8f0'
const W  = '#ffffff'

const ROLE_LABEL: Record<string, string> = {
  REGIONAL_MANAGER: 'Regional Manager',
  TEAM_MEMBER: 'Team Member',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
}

const s = StyleSheet.create({
  page:      { backgroundColor: W, fontFamily: 'Helvetica', fontSize: 9, color: '#1e293b', paddingBottom: 36 },
  header:    { backgroundColor: N, paddingHorizontal: 28, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logoBox:   { width: 22, height: 22, backgroundColor: L, borderRadius: 4, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  logoTxt:   { color: N, fontFamily: 'Helvetica-Bold', fontSize: 13 },
  brandCol:  { flexDirection: 'row', alignItems: 'center' },
  brandName: { color: W, fontFamily: 'Helvetica-Bold', fontSize: 13 },
  brandSub:  { color: L, fontSize: 7, marginTop: 1 },
  hRight:    { alignItems: 'flex-end' },
  hRightLbl: { color: '#94a3b8', fontSize: 7 },
  hRightVal: { color: W, fontFamily: 'Helvetica-Bold', fontSize: 10, marginTop: 1 },

  meta:      { backgroundColor: LT, borderBottomWidth: 1, borderBottomColor: BD, paddingHorizontal: 28, paddingVertical: 8, flexDirection: 'row', gap: 24 },
  metaLbl:   { color: SL, fontSize: 7, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaVal:   { color: N, fontFamily: 'Helvetica-Bold', fontSize: 9, marginTop: 1 },

  body:      { paddingHorizontal: 28, paddingTop: 14 },

  cards:     { flexDirection: 'row', gap: 7, marginBottom: 14 },
  card:      { flex: 1, backgroundColor: LT, borderWidth: 1, borderColor: BD, borderRadius: 5, padding: 9 },
  cardLbl:   { color: SL, fontSize: 7, textTransform: 'uppercase', letterSpacing: 0.4 },
  cardVal:   { color: N, fontFamily: 'Helvetica-Bold', fontSize: 15, marginTop: 2 },

  secTitle:  { fontFamily: 'Helvetica-Bold', fontSize: 8, color: N, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5, paddingBottom: 3, borderBottomWidth: 1, borderBottomColor: BD },
  sec:       { marginBottom: 14 },

  tbl:       { borderWidth: 1, borderColor: BD, borderRadius: 3, overflow: 'hidden' },
  tHead:     { flexDirection: 'row', backgroundColor: N, paddingVertical: 5, paddingHorizontal: 7 },
  tHCell:    { color: L, fontFamily: 'Helvetica-Bold', fontSize: 7, textTransform: 'uppercase', letterSpacing: 0.3 },
  tRow:      { flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 7, borderBottomWidth: 1, borderBottomColor: BD },
  tRowAlt:   { backgroundColor: LT },
  tCell:     { fontSize: 8, color: '#334155' },
  tCellBold: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: '#1e293b' },

  divider:   { borderBottomWidth: 1, borderBottomColor: BD, marginVertical: 14 },

  footer:    { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 1, borderTopColor: BD, paddingHorizontal: 28, paddingVertical: 7, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: W },
  footerTxt: { color: '#94a3b8', fontSize: 7 },
  footerBold:{ color: N, fontFamily: 'Helvetica-Bold', fontSize: 7 },
  emptyTxt:  { color: SL, fontSize: 8, textAlign: 'center', padding: 12 },
})

interface StaffMember {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
  designation: string | null
  department: string | null
  dateOfJoining: Date | null
  leads: { total: number; disbursed: number; disbursedValue: number }
  attendance: { present: number; leave: number; outstation: number; halfDay: number }
}

interface StaffReportData {
  clinicName: string
  periodLabel: string
  staff: StaffMember[]
  totalLeads: number
  totalDisbursed: number
  totalDisbursedValue: number
}

// ── Directory table cols ──────────────────────────────────────────────────────
const DIR_COLS = [
  { label: '#',          width: '5%'  },
  { label: 'Name',       width: '22%' },
  { label: 'Role',       width: '18%' },
  { label: 'Designation',width: '18%' },
  { label: 'Email',      width: '25%' },
  { label: 'Phone',      width: '12%' },
]

// ── Performance table cols ────────────────────────────────────────────────────
const PERF_COLS = [
  { label: '#',            width: '5%'  },
  { label: 'Staff Name',   width: '22%' },
  { label: 'Role',         width: '14%' },
  { label: 'Total Leads',  width: '12%' },
  { label: 'Approved',     width: '10%' },
  { label: 'Disbursed',    width: '10%' },
  { label: 'Disb. ₹L',    width: '13%' },
  { label: 'Approval %',   width: '14%' },
]

// ── Attendance summary cols ───────────────────────────────────────────────────
const ATT_COLS = [
  { label: '#',          width: '5%'  },
  { label: 'Staff Name', width: '28%' },
  { label: 'Present',    width: '13%' },
  { label: 'Half-day',   width: '13%' },
  { label: 'Leave',      width: '13%' },
  { label: 'Outstation', width: '13%' },
  { label: 'Total Rec.', width: '15%' },
]

function StaffReportPDF({ d }: { d: StaffReportData }) {
  const generatedOn = format(new Date(), 'dd/MM/yyyy HH:mm')
  const avgLeads = d.staff.length > 0 ? (d.totalLeads / d.staff.length).toFixed(1) : '0'

  return (
    <Document title={`Staff Report — ${d.clinicName} — ${d.periodLabel}`} author="Trustiva Setu">
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
            <Text style={s.hRightLbl}>STAFF REPORT</Text>
            <Text style={s.hRightVal}>{d.periodLabel}</Text>
          </View>
        </View>

        {/* Meta */}
        <View style={s.meta}>
          <View><Text style={s.metaLbl}>Clinic</Text><Text style={s.metaVal}>{d.clinicName}</Text></View>
          <View><Text style={s.metaLbl}>Period</Text><Text style={s.metaVal}>{d.periodLabel}</Text></View>
          <View><Text style={s.metaLbl}>Generated</Text><Text style={s.metaVal}>{generatedOn}</Text></View>
        </View>

        <View style={s.body}>
          {/* Summary cards */}
          <View style={s.cards}>
            <View style={s.card}>
              <Text style={s.cardLbl}>Assigned Staff</Text>
              <Text style={s.cardVal}>{d.staff.length}</Text>
            </View>
            <View style={s.card}>
              <Text style={s.cardLbl}>Total Leads</Text>
              <Text style={s.cardVal}>{d.totalLeads}</Text>
            </View>
            <View style={s.card}>
              <Text style={s.cardLbl}>Avg Leads / Staff</Text>
              <Text style={s.cardVal}>{avgLeads}</Text>
            </View>
            <View style={s.card}>
              <Text style={s.cardLbl}>Disbursed</Text>
              <Text style={s.cardVal}>{d.totalDisbursed}</Text>
            </View>
            <View style={s.card}>
              <Text style={s.cardLbl}>Disbursed Value ₹L</Text>
              <Text style={[s.cardVal, { color: '#16a34a', fontSize: 13 }]}>{d.totalDisbursedValue.toFixed(1)}</Text>
            </View>
          </View>

          {/* Staff Directory */}
          <View style={s.sec}>
            <Text style={s.secTitle}>Staff Directory</Text>
            <View style={s.tbl}>
              <View style={s.tHead}>
                {DIR_COLS.map(c => <Text key={c.label} style={[s.tHCell, { width: c.width }]}>{c.label}</Text>)}
              </View>
              {d.staff.length === 0
                ? <Text style={s.emptyTxt}>No staff assigned</Text>
                : d.staff.map((m, i) => (
                  <View key={m.id} style={[s.tRow, i % 2 === 1 ? s.tRowAlt : {}]} wrap={false}>
                    <Text style={[s.tCell,     { width: '5%' }]}>{i + 1}</Text>
                    <Text style={[s.tCellBold, { width: '22%' }]}>{m.name}</Text>
                    <Text style={[s.tCell,     { width: '18%' }]}>{ROLE_LABEL[m.role] ?? m.role}</Text>
                    <Text style={[s.tCell,     { width: '18%' }]}>{m.designation ?? '—'}</Text>
                    <Text style={[s.tCell,     { width: '25%' }]}>{m.email}</Text>
                    <Text style={[s.tCell,     { width: '12%' }]}>{m.phone ?? '—'}</Text>
                  </View>
                ))
              }
            </View>
          </View>

          {/* Lead Performance */}
          <View style={s.sec}>
            <Text style={s.secTitle}>Lead Performance — {d.periodLabel}</Text>
            <View style={s.tbl}>
              <View style={s.tHead}>
                {PERF_COLS.map(c => <Text key={c.label} style={[s.tHCell, { width: c.width }]}>{c.label}</Text>)}
              </View>
              {d.staff.length === 0
                ? <Text style={s.emptyTxt}>No data</Text>
                : d.staff.map((m, i) => {
                    const approv = m.leads.disbursed  // simplified: disbursed ⊂ approved
                    const rate = m.leads.total > 0
                      ? ((approv / m.leads.total) * 100).toFixed(0) + '%'
                      : '—'
                    return (
                      <View key={m.id} style={[s.tRow, i % 2 === 1 ? s.tRowAlt : {}]} wrap={false}>
                        <Text style={[s.tCell,     { width: '5%'  }]}>{i + 1}</Text>
                        <Text style={[s.tCellBold, { width: '22%' }]}>{m.name}</Text>
                        <Text style={[s.tCell,     { width: '14%' }]}>{ROLE_LABEL[m.role] ?? m.role}</Text>
                        <Text style={[s.tCell,     { width: '12%', fontFamily: 'Helvetica-Bold', color: '#2563eb' }]}>{m.leads.total}</Text>
                        <Text style={[s.tCell,     { width: '10%' }]}>{approv}</Text>
                        <Text style={[s.tCell,     { width: '10%', color: '#16a34a' }]}>{m.leads.disbursed}</Text>
                        <Text style={[s.tCell,     { width: '13%', color: m.leads.disbursedValue > 0 ? '#16a34a' : SL }]}>
                          {m.leads.disbursedValue > 0 ? m.leads.disbursedValue.toFixed(1) : '—'}
                        </Text>
                        <Text style={[s.tCell,     { width: '14%' }]}>{rate}</Text>
                      </View>
                    )
                  })
              }
            </View>
          </View>

          {/* Attendance Summary */}
          <View style={s.sec}>
            <Text style={s.secTitle}>Attendance Summary — {d.periodLabel}</Text>
            <View style={s.tbl}>
              <View style={s.tHead}>
                {ATT_COLS.map(c => <Text key={c.label} style={[s.tHCell, { width: c.width }]}>{c.label}</Text>)}
              </View>
              {d.staff.length === 0
                ? <Text style={s.emptyTxt}>No data</Text>
                : d.staff.map((m, i) => {
                    const total = m.attendance.present + m.attendance.leave + m.attendance.outstation
                    return (
                      <View key={m.id} style={[s.tRow, i % 2 === 1 ? s.tRowAlt : {}]} wrap={false}>
                        <Text style={[s.tCell,     { width: '5%'  }]}>{i + 1}</Text>
                        <Text style={[s.tCellBold, { width: '28%' }]}>{m.name}</Text>
                        <Text style={[s.tCell,     { width: '13%', color: '#16a34a' }]}>{m.attendance.present}</Text>
                        <Text style={[s.tCell,     { width: '13%', color: SL }]}>{m.attendance.halfDay > 0 ? m.attendance.halfDay : '—'}</Text>
                        <Text style={[s.tCell,     { width: '13%', color: '#d97706' }]}>{m.attendance.leave > 0 ? m.attendance.leave : '—'}</Text>
                        <Text style={[s.tCell,     { width: '13%', color: '#7c3aed' }]}>{m.attendance.outstation > 0 ? m.attendance.outstation : '—'}</Text>
                        <Text style={[s.tCell,     { width: '15%' }]}>{total}</Text>
                      </View>
                    )
                  })
              }
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerTxt}>Confidential — {d.clinicName} — {d.periodLabel}</Text>
          <Text style={s.footerBold}>Trustiva Setu LMS</Text>
          <Text style={s.footerTxt} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>

      </Page>
    </Document>
  )
}

export async function generateStaffReportPdf(data: StaffReportData): Promise<Buffer> {
  return renderToBuffer(<StaffReportPDF d={data} />) as Promise<Buffer>
}
