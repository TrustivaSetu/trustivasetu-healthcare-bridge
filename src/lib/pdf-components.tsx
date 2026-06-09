/**
 * Shared PDF primitives for clinic portal reports.
 * Uses @react-pdf/renderer v4 — all JSX here renders to PDF, not HTML.
 * Do NOT import Tailwind/HTML components here.
 */
import React from 'react'
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
} from '@react-pdf/renderer'

Font.registerHyphenationCallback(w => [w])

// ── Design tokens ────────────────────────────────────────────────────────────
const NAVY = '#07111f'
const LIME = '#bef264'
const SLATE = '#64748b'
const LIGHT = '#f8fafc'
const BORDER = '#e2e8f0'
const WHITE = '#ffffff'
const GREEN = '#16a34a'
const RED = '#dc2626'
const AMBER = '#d97706'

// ── Styles ───────────────────────────────────────────────────────────────────
export const styles = StyleSheet.create({
  page: {
    backgroundColor: WHITE,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1e293b',
    paddingBottom: 40,
  },

  // Header bar
  header: {
    backgroundColor: NAVY,
    paddingHorizontal: 28,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogo: {
    width: 22,
    height: 22,
    backgroundColor: LIME,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogoText: {
    color: NAVY,
    fontFamily: 'Helvetica-Bold',
    fontSize: 12,
  },
  headerTitle: {
    color: WHITE,
    fontFamily: 'Helvetica-Bold',
    fontSize: 13,
  },
  headerSub: {
    color: LIME,
    fontSize: 8,
    marginTop: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  headerRightLabel: {
    color: '#94a3b8',
    fontSize: 7,
  },
  headerRightValue: {
    color: WHITE,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    marginTop: 1,
  },

  // Meta strip below header
  metaStrip: {
    backgroundColor: LIGHT,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingHorizontal: 28,
    paddingVertical: 8,
    flexDirection: 'row',
    gap: 24,
  },
  metaItem: {
    flexDirection: 'column',
  },
  metaLabel: {
    color: SLATE,
    fontSize: 7,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    color: NAVY,
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    marginTop: 1,
  },

  // Body
  body: {
    paddingHorizontal: 28,
    paddingTop: 16,
  },

  // Section
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    color: NAVY,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  section: {
    marginBottom: 18,
  },

  // Summary cards row
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: LIGHT,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    padding: 10,
  },
  summaryCardLabel: {
    color: SLATE,
    fontSize: 7,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  summaryCardValue: {
    color: NAVY,
    fontFamily: 'Helvetica-Bold',
    fontSize: 16,
    marginTop: 3,
  },
  summaryCardSub: {
    color: SLATE,
    fontSize: 7,
    marginTop: 2,
  },

  // Table
  table: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: NAVY,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    color: LIME,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRowAlt: {
    backgroundColor: LIGHT,
  },
  tableCell: {
    fontSize: 8,
    color: '#334155',
  },
  tableCellBold: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#1e293b',
  },

  // Status badges (inline text with color)
  statusPending: { color: AMBER },
  statusApproved: { color: '#2563eb' },
  statusDisbursed: { color: GREEN },
  statusRejected: { color: RED },
  statusCancelled: { color: SLATE },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    paddingHorizontal: 28,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: WHITE,
  },
  footerText: {
    color: '#94a3b8',
    fontSize: 7,
  },
  footerBrand: {
    color: NAVY,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
  },
})

// ── Reusable components ───────────────────────────────────────────────────────

export function PdfHeader({
  clinicName,
  period,
  reportType,
  generatedOn,
}: {
  clinicName: string
  period: string
  reportType: string
  generatedOn: string
}) {
  return (
    <>
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <View style={styles.headerLogo}>
            <Text style={styles.headerLogoText}>T</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Trustiva Setu</Text>
            <Text style={styles.headerSub}>Clinic Portal</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.headerRightLabel}>{reportType.toUpperCase()}</Text>
          <Text style={styles.headerRightValue}>{period}</Text>
        </View>
      </View>

      <View style={styles.metaStrip}>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Clinic</Text>
          <Text style={styles.metaValue}>{clinicName}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Period</Text>
          <Text style={styles.metaValue}>{period}</Text>
        </View>
        <View style={styles.metaItem}>
          <Text style={styles.metaLabel}>Generated On</Text>
          <Text style={styles.metaValue}>{generatedOn}</Text>
        </View>
      </View>
    </>
  )
}

export function PdfFooter({ page }: { page?: boolean }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Confidential — For authorised clinic use only</Text>
      <Text style={styles.footerBrand}>Trustiva Setu LMS</Text>
      {page && (
        <Text
          style={styles.footerText}
          render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
        />
      )}
    </View>
  )
}

export function SummaryCards({ cards }: { cards: { label: string; value: string; sub?: string }[] }) {
  return (
    <View style={styles.summaryRow}>
      {cards.map((c, i) => (
        <View key={i} style={styles.summaryCard}>
          <Text style={styles.summaryCardLabel}>{c.label}</Text>
          <Text style={styles.summaryCardValue}>{c.value}</Text>
          {c.sub && <Text style={styles.summaryCardSub}>{c.sub}</Text>}
        </View>
      ))}
    </View>
  )
}

export function statusStyle(status: string) {
  const map: Record<string, object> = {
    PENDING: styles.statusPending,
    DOCS_PENDING: styles.statusPending,
    APPROVED: styles.statusApproved,
    DISBURSED: styles.statusDisbursed,
    REJECTED: styles.statusRejected,
    CANCELLED: styles.statusCancelled,
  }
  return map[status] ?? {}
}

export { Document, Page, View, Text }
