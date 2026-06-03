/**
 * Hard-deletes ALL demo/seed data from the LMS.
 * Keeps: Users, Regions, RolePermissions, SchemeTemplates, AuditLogs.
 * Run: node scripts/nuke-demo-data.mjs
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import pkg from 'pg'

const { Client } = pkg

// Parse .env file (handles quoted values and special chars)
function loadEnv() {
  const __dir = dirname(fileURLToPath(import.meta.url))
  try {
    const text = readFileSync(join(__dir, '..', '.env'), 'utf8')
    for (const line of text.split('\n')) {
      const eq = line.indexOf('=')
      if (eq === -1 || line.startsWith('#')) continue
      const key = line.slice(0, eq).trim()
      let val = line.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (key && !process.env[key]) process.env[key] = val
    }
  } catch { /* rely on existing env */ }
}
loadEnv()

const connStr = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL
if (!connStr) {
  console.error('DATABASE_URL not set in .env')
  process.exit(1)
}

const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } })

async function q(sql, label) {
  const res = await client.query(sql)
  const n = res.rowCount ?? 0
  console.log(`  ✓ ${n} ${label}`)
  return n
}

async function count(table) {
  const res = await client.query(`SELECT COUNT(*) FROM "${table}"`)
  return parseInt(res.rows[0].count, 10)
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║   TRUSTIVA LMS — NUKE DEMO DATA                  ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  await client.connect()

  const [leads, clinics, lenders, leaveRequests, attendances, expenses, clinicSchemes] =
    await Promise.all([
      count('Lead'), count('Clinic'), count('Lender'),
      count('LeaveRequest'), count('Attendance'), count('Expense'), count('ClinicScheme'),
    ])

  console.log('Records to delete:')
  console.log(`  Leads:           ${leads}`)
  console.log(`  Clinics:         ${clinics}`)
  console.log(`  Lenders:         ${lenders}`)
  console.log(`  Leave Requests:  ${leaveRequests}`)
  console.log(`  Attendances:     ${attendances}`)
  console.log(`  Expenses:        ${expenses}`)
  console.log(`  Clinic Schemes:  ${clinicSchemes}`)
  console.log(`  Users:           KEPT\n`)

  const total = leads + clinics + lenders + leaveRequests + attendances + expenses + clinicSchemes
  if (total === 0) {
    console.log('Nothing to delete — already clean.\n')
    return
  }

  console.log('Deleting in dependency order...\n')

  // Delete in FK-safe order
  await q('DELETE FROM "ClinicScheme"', 'clinic scheme(s) deleted')
  await q('DELETE FROM "Attendance"', 'attendance record(s) deleted')
  await q('DELETE FROM "LeaveRequest"', 'leave request(s) deleted')
  await q('DELETE FROM "ExpenseItem"', 'expense item(s) deleted')
  await q('DELETE FROM "Expense"', 'expense claim(s) deleted')
  await q('DELETE FROM "Lead"', 'lead(s) deleted')
  await q('DELETE FROM "Target"', 'target(s) deleted')
  await q('DELETE FROM "UserClinic"', 'user-clinic assignment(s) deleted')
  await q('UPDATE "Clinic" SET "assignedRMId" = NULL', 'clinic RM assignments nulled')
  await q('DELETE FROM "Clinic"', 'clinic(s) deleted')
  await q('DELETE FROM "Lender"', 'lender(s) deleted')

  console.log('\nDone. LMS is clean — ready for real production data.\n')
}

main()
  .catch(e => { console.error('Error:', e.message); process.exit(1) })
  .finally(() => client.end())
