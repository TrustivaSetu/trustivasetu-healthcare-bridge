import { db } from '@/lib/db'
import { calculateSalary } from '@/lib/hr/salary'
import { getTravelRatePerKm, getMonthlyTravelCap } from '@/lib/hr/expenses'

export const COMPANY = {
  name: 'Trustivasetu',
  fullName: 'Trustivasetu - A Division of Aarthsetu Technologies Private Limited',
  address: '5/70, Friend\'s Colony, Chandranagar, Moradabad (U.P.) - 244001',
  website: 'www.trustivasetu.com',
  email: 'admin@trustivasetu.com',
  signatoryName: 'CEO',
  signatoryTitle: 'CEO',
}

// All recipients who receive the acknowledgement email
export const ACK_EMAIL_RECIPIENTS = [
  'admin@trustivasetu.com',
  'abhishek.kashyap@trustivasetu.com',
  'ajit.yadav@trustivasetu.com',
]

export const TERMS = [
  'This appointment is subject to successful completion of document verification and background check.',
  'The probation period is 3 months from the date of joining, during which either party may terminate with 7 days\' notice.',
  'After confirmation, the notice period is 30 days from either side. For Manager and above, the notice period is 60 days. The company may pay notice period salary in lieu of serving notice.',
  'The employee agrees to maintain strict confidentiality of all company data, client information, financial records, and proprietary information during and after employment.',
  'The employee shall not engage in any employment, business, or activity that conflicts with the company\'s interests during the tenure of employment.',
  'Non-compete clause: The employee shall not join a direct competitor or start a competing business for a period of 6 months post exit from the organization.',
  'The employee agrees to abide by all HR policies, code of conduct, and guidelines as published in the company HR Policy document and any subsequent updates thereof.',
  'This letter supersedes all prior verbal or written communications, agreements, or representations regarding this employment offer.',
  'Employment is subject to the company\'s policies and applicable laws. The company reserves the right to amend policies with reasonable notice.',
]

export async function generateLetterNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const count = await db.appointmentLetter.count({
    where: { letterNumber: { startsWith: `TS/APT/${year}/` } },
  })
  return `TS/APT/${year}/${String(count + 1).padStart(4, '0')}`
}

export async function generateAppointmentLetter(userId: string) {
  // Check for existing active letter
  const existing = await db.appointmentLetter.findFirst({
    where: { userId, isArchived: false },
    orderBy: { version: 'desc' },
  })
  if (existing) return { letter: existing, alreadyExists: true }

  // Get user with full profile
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      employeeProfile: true,
      reportingManager: { include: { employeeProfile: true } },
    },
  })
  if (!user) return { error: 'User not found' }

  // Salary must exist
  const salary = await db.salaryStructure.findUnique({ where: { userId } })
  if (!salary) return { noSalary: true }

  const components = calculateSalary(salary.grossSalary, salary.tds)
  const designation = user.employeeProfile?.designation ?? null

  const letter = await db.appointmentLetter.create({
    data: {
      userId,
      letterNumber: await generateLetterNumber(),
      status: 'PENDING_ACKNOWLEDGEMENT',
      employeeName: user.name,
      designation,
      department: user.employeeProfile?.department,
      dateOfJoining: user.employeeProfile?.dateOfJoining,
      employmentType: 'PROBATION',
      reportingManagerName: user.reportingManager?.name,
      reportingManagerDesignation: user.reportingManager?.employeeProfile?.designation,
      workLocation: 'Head Office, Moradabad (U.P.)',
      grossSalary: salary.grossSalary,
      salaryBreakdown: components as object,
      travelRatePerKm: getTravelRatePerKm(designation),
      monthlyExpenseCap: getMonthlyTravelCap(designation),
    },
  })

  return { letter }
}

// ── Email templates ────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
}

function fmtDate(d: Date | string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
}

const HEADER = `
<div style="background:#0F172A;padding:20px 32px;text-align:center">
  <p style="color:#A3E635;font-size:18px;font-weight:bold;margin:0">${COMPANY.name}</p>
  <p style="color:#94a3b8;font-size:11px;margin:3px 0 0">${COMPANY.fullName}</p>
  <p style="color:#64748b;font-size:10px;margin:3px 0 0">${COMPANY.address} | ${COMPANY.website}</p>
</div>`

const FOOTER = `
<div style="background:#f9fafb;padding:12px 32px;text-align:center;font-size:10px;color:#9ca3af;border-top:1px solid #e5e7eb">
  ${COMPANY.fullName}<br>${COMPANY.address} | ${COMPANY.website} | ${COMPANY.email}
</div>`

function wrapper(inner: string) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;color:#111;margin:0;padding:20px;background:#f4f4f5">
<div style="max-width:720px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.1)">
${HEADER}
<div style="padding:28px 32px">${inner}</div>
${FOOTER}
</div></body></html>`
}

/**
 * Acknowledgement notification email — sent to ALL recipients (employee + team).
 * Subject: Appointment Letter Acknowledged - {Name} - {Designation}
 */
export function buildAcknowledgementEmailHtml(opts: {
  employeeName: string
  designation: string | null
  letterNumber: string
  acknowledgedAt: Date
  portalUrl: string
  salaryBreakdown: Record<string, number> | null
  grossSalary: number | null
}): string {
  const bd = opts.salaryBreakdown
  const ackDate = fmtDate(opts.acknowledgedAt)

  const salaryTable = bd && opts.grossSalary ? `
  <div style="margin-top:20px">
    <p style="font-size:12px;font-weight:bold;color:#0F172A;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin-bottom:0">Monthly Salary Structure</p>
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:0">
      ${[
        ['Basic Salary (40%)', fmt(bd.basic ?? 0), '#fff'],
        ['HRA (20%)', fmt(bd.hra ?? 0), '#f9fafb'],
        ['Special Allowance', fmt(bd.specialAllowance ?? 0), '#fff'],
        ['Conveyance Allowance', '₹1,600', '#f9fafb'],
        ['Medical Allowance', '₹1,250', '#fff'],
        ['LTA', fmt(bd.lta ?? 0), '#f9fafb'],
      ].map(([l, v, bg]) => `<tr style="background:${bg}"><td style="padding:5px 8px;color:#374151">${l}</td><td style="padding:5px 8px;text-align:right;font-weight:600">${v}</td></tr>`).join('')}
      <tr style="background:#dbeafe;font-weight:bold"><td style="padding:6px 8px">Gross Salary</td><td style="padding:6px 8px;text-align:right">${fmt(opts.grossSalary)}</td></tr>
      <tr><td style="padding:5px 8px;color:#dc2626">(-) Employee PF (12%)</td><td style="padding:5px 8px;text-align:right;color:#dc2626">− ${fmt(bd.employeePF ?? 0)}</td></tr>
      <tr style="background:#f9fafb"><td style="padding:5px 8px;color:#dc2626">(-) Professional Tax</td><td style="padding:5px 8px;text-align:right;color:#dc2626">− ₹200</td></tr>
      <tr style="background:#dcfce7;font-weight:bold"><td style="padding:6px 8px">Net Take Home Salary</td><td style="padding:6px 8px;text-align:right">${fmt(bd.netSalary ?? 0)}</td></tr>
      <tr style="background:#f0f9ff;font-weight:bold"><td style="padding:6px 8px">Annual CTC</td><td style="padding:6px 8px;text-align:right">${fmt((bd.totalCTC ?? 0) * 12)}</td></tr>
    </table>
  </div>` : ''

  return wrapper(`
  <div style="text-align:center;margin-bottom:20px">
    <div style="display:inline-block;background:#dcfce7;border-radius:50%;width:56px;height:56px;line-height:56px;font-size:26px">✓</div>
    <h2 style="margin:10px 0 4px;color:#111827;font-size:18px">Appointment Letter Acknowledged</h2>
    <p style="margin:0;color:#6b7280;font-size:13px">Letter No: ${opts.letterNumber}</p>
  </div>

  <p style="font-size:14px;color:#374151;line-height:1.7;margin-bottom:16px">
    Dear Team,<br><br>
    <strong>${opts.employeeName}</strong> (${opts.designation ?? 'Employee'}) has acknowledged their appointment letter
    dated <strong>${ackDate}</strong>. Please find the signed appointment letter details below.
  </p>

  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px">
    <tr style="background:#f9fafb"><td style="padding:6px 10px;color:#6b7280;width:180px">Employee Name</td><td style="padding:6px 10px;font-weight:600">${opts.employeeName}</td></tr>
    <tr><td style="padding:6px 10px;color:#6b7280">Designation</td><td style="padding:6px 10px;font-weight:600">${opts.designation ?? '—'}</td></tr>
    <tr style="background:#f9fafb"><td style="padding:6px 10px;color:#6b7280">Letter Number</td><td style="padding:6px 10px;font-weight:600">${opts.letterNumber}</td></tr>
    <tr><td style="padding:6px 10px;color:#6b7280">Acknowledged On</td><td style="padding:6px 10px;font-weight:600;color:#16a34a">${ackDate}</td></tr>
  </table>

  ${salaryTable}

  <div style="text-align:center;margin:24px 0 8px">
    <a href="${opts.portalUrl}" style="background:#0F172A;color:#A3E635;font-weight:bold;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:13px">
      View Signed Appointment Letter →
    </a>
  </div>
  <p style="text-align:center;font-size:11px;color:#9ca3af;margin:8px 0 0">
    Click above to view or download the complete signed letter from the portal.
  </p>`)
}

/**
 * Notification to employee when their letter is ready after salary is configured.
 */
export function buildLetterReadyEmailHtml(opts: {
  employeeName: string
  letterNumber: string
  portalUrl: string
}): string {
  return wrapper(`
  <h2 style="margin:0 0 12px;color:#111827;font-size:18px">Your Appointment Letter is Ready</h2>
  <p style="font-size:14px;color:#374151;line-height:1.7">
    Dear <strong>${opts.employeeName}</strong>,<br><br>
    Your appointment letter (<strong>${opts.letterNumber}</strong>) has been generated and is ready for your review and acknowledgement.
    Please log in to the portal to view the complete letter including your salary structure and terms of employment.
  </p>
  <div style="text-align:center;margin:24px 0">
    <a href="${opts.portalUrl}" style="background:#0F172A;color:#A3E635;font-weight:bold;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px">
      View &amp; Acknowledge Your Letter →
    </a>
  </div>
  <p style="font-size:12px;color:#9ca3af;text-align:center">
    Please review the letter carefully and click "Acknowledge &amp; Accept" to confirm your acceptance.
  </p>`)
}

/** Legacy function — kept for resend flow */
export function buildLetterEmailHtml(letter: {
  letterNumber: string; employeeName: string; designation: string | null
  department: string | null; dateOfJoining: Date | string | null
  grossSalary: number | null; salaryBreakdown: Record<string, number> | null
  acknowledgedAt: Date | string | null
}, portalUrl: string): string {
  return buildAcknowledgementEmailHtml({
    employeeName: letter.employeeName,
    designation: letter.designation,
    letterNumber: letter.letterNumber,
    acknowledgedAt: letter.acknowledgedAt ? new Date(letter.acknowledgedAt) : new Date(),
    portalUrl,
    salaryBreakdown: letter.salaryBreakdown,
    grossSalary: letter.grossSalary,
  })
}
