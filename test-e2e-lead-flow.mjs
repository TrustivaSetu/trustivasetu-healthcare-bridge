import { chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const BASE = 'http://localhost:3000'
const SHOTS = path.join(process.cwd(), 'test-shots-e2e')
fs.mkdirSync(SHOTS, { recursive: true })

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

const errors = []
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
page.on('pageerror', e => errors.push('[pageerror] ' + e.message))

let n = 0
async function shot(label) {
  n++
  const f = path.join(SHOTS, `${String(n).padStart(2,'0')}-${label}.png`)
  await page.screenshot({ path: f, fullPage: true })
  console.log(`  [shot] ${f}`)
}

const results = {}

// ── 0. Login ───────────────────────────────────────────────────────────────
console.log('\n=== 0. Login ===')
await page.goto(BASE + '/lms/login', { waitUntil: 'networkidle' })
await page.waitForSelector('input[type="email"]', { timeout: 20000 })
await page.fill('input[type="email"]', 'admin@trustivasetu.com')
await page.fill('input[type="password"]', 'tNFyFgTyKvoNy9_z')
await shot('login-form')
await page.click('button[type="submit"]')
try {
  await page.waitForURL('**/dashboard', { timeout: 90000 })
  console.log('  ✓ Logged in → dashboard')
  results.login = true
} catch {
  await shot('login-fail')
  console.log('  ✗ Login failed or timed out')
  results.login = false
}
await shot('dashboard')

// ── 1. Navigate to Leads ───────────────────────────────────────────────────
console.log('\n=== 1. Leads page ===')
await page.goto(BASE + '/leads', { waitUntil: 'networkidle', timeout: 120000 })
await page.waitForSelector('button:has-text("Add Lead")', { timeout: 30000 })
console.log('  ✓ Leads page loaded')
await shot('leads-page')

// Debug: check clinics API from browser context
const clinicsApiResult = await page.evaluate(async () => {
  try {
    const res = await fetch('/api/clinics?minimal=1')
    const data = await res.json()
    return { status: res.status, count: data.data?.length ?? -1, data }
  } catch (e) { return { error: String(e) } }
})
console.log(`\n  [debug] clinics API: status=${clinicsApiResult.status} count=${clinicsApiResult.count}`)
if (clinicsApiResult.error) console.log(`  [debug] clinics error:`, clinicsApiResult.error)

// ── 2. Open Add Lead form ──────────────────────────────────────────────────
console.log('\n=== 2. Open Add Lead form ===')
await page.click('button:has-text("Add Lead")')
await page.waitForSelector('text=Basic Info', { timeout: 5000 })
console.log('  ✓ Form opened on Step 1')
await shot('step1-basic-info')

// ── 3. Step 1: Basic Info ──────────────────────────────────────────────────
console.log('\n=== 3. Step 1 — Basic Info ===')
// Scope to the modal
const modal = page.locator('.fixed.inset-0').last()
await modal.locator('input[placeholder="Full name as per Aadhaar"]').fill('Test Patient Playwright')
await modal.locator('input[placeholder="10-digit mobile number"]').fill('9876543210')
await modal.locator('input[type="checkbox"]').check()
await shot('step1-filled')

await modal.locator('button:has-text("Next: KYC")').click()
await page.waitForTimeout(800)  // toast + transition
console.log('  ✓ Clicked Next — OTP step should be auto-bypassed')

// ── 4. Step 3: KYC ────────────────────────────────────────────────────────
console.log('\n=== 4. Step 3 — KYC ===')
await page.waitForSelector('text=KYC Verification', { timeout: 5000 })
console.log('  ✓ KYC step reached (OTP was auto-skipped)')
await shot('step3-kyc')
await modal.locator('button:has-text("Next: Employment")').click()

// ── 5. Step 4: Employment ──────────────────────────────────────────────────
console.log('\n=== 5. Step 4 — Employment ===')
await page.waitForSelector('text=Employment & Income', { timeout: 5000 })
await modal.locator('button:has-text("Salaried")').click()
await modal.locator('input[type="number"]').fill('60000')
await modal.locator('input[placeholder="6-digit"]').fill('110001')
await shot('step4-employment')
await modal.locator('button:has-text("Next: Treatment")').click()

// ── 6. Step 5: Treatment & Scheme ─────────────────────────────────────────
console.log('\n=== 6. Step 5 — Treatment & Scheme ===')
await page.waitForSelector('text=Treatment & Loan Scheme', { timeout: 5000 })
await shot('step5-treatment-empty')

// Wait for clinics to load (API compilation can take 10-15s on cold start)
const clinicSelect = modal.locator('select').first()
await clinicSelect.waitFor({ timeout: 5000 })
console.log('  Waiting for clinics to load from API...')
try {
  await page.waitForFunction(
    () => {
      const sel = document.querySelectorAll('select')[0]
      return sel && sel.options.length > 1
    },
    { timeout: 30000 }
  )
  console.log('  ✓ Clinics loaded')
} catch {
  console.log('  ✗ Clinics did not load in 30s')
}
const clinicOptions = await clinicSelect.locator('option').count()
console.log(`  Clinics in dropdown: ${clinicOptions - 1}`)
results.hasClinics = clinicOptions > 1

if (clinicOptions > 1) {
  await clinicSelect.selectOption({ index: 1 })
  console.log('  ✓ Clinic selected')
} else {
  console.log('  ✗ No clinics available — DB may have no active clinics')
}

// Category (2nd select) and Treatment (3rd select)
const allSelects = modal.locator('select')
await allSelects.nth(1).selectOption({ index: 1 })  // first category
await page.waitForTimeout(300)
await allSelects.nth(2).selectOption({ index: 1 })  // first treatment in that category
await page.waitForTimeout(300)
console.log('  ✓ Category + Treatment selected')

// Loan amount
await modal.locator('input[type="number"]').fill('75000')
await page.waitForTimeout(600)  // LoanSchemeSelector renders
console.log('  ✓ Loan amount set to ₹75,000')

// Scheme auto-selects (Zero DP, 2%, 12m) — no interaction needed
const schemeVisible = await page.locator('text=Zero Downpayment').isVisible().catch(() => false)
console.log(`  Scheme selector visible: ${schemeVisible}`)
await shot('step5-scheme-loaded')

// Click Get Smart Offers (TESTING_MODE injects mock offer)
await modal.locator('button:has-text("Get Smart Offers")').click()

// ── 7. Step 6: Smart Qualify ───────────────────────────────────────────────
console.log('\n=== 7. Step 6 — Smart Qualify (mock) ===')
await page.waitForSelector('text=Smart Pre-Qualification', { timeout: 5000 })
await shot('step6-qualify')

const mockOfferVisible = await page.locator('text=Mock Lender (Testing)').isVisible().catch(() => false)
const testingBannerVisible = await page.locator('text=Testing Mode').first().isVisible().catch(() => false)
console.log(`  Mock offer visible: ${mockOfferVisible}`)
console.log(`  Testing Mode banner: ${testingBannerVisible}`)
results.mockOffer = mockOfferVisible

await modal.locator('button:has-text("Next: Confirm Offer")').click()

// ── 8. Step 7: Confirm Offer ───────────────────────────────────────────────
console.log('\n=== 8. Step 7 — Confirm Offer ===')
await page.waitForSelector('text=Confirm Offer', { timeout: 5000 })
await shot('step7-confirm')

const offerAmountVisible = await page.locator('text=Mock Lender').isVisible().catch(() => false)
console.log(`  Offer summary visible: ${offerAmountVisible}`)

// Accept & Submit
await modal.locator('button:has-text("Accept & Submit")').click()
console.log('  Clicked Accept & Submit — waiting for lead creation...')
await page.waitForTimeout(5000)  // API call + form close + fetchLeads refresh

// ── 9. Verify lead in table ────────────────────────────────────────────────
console.log('\n=== 9. Verify Lead in Table ===')
await shot('after-submit')

const leadInTable = await page.locator('text=Test Patient Playwright').isVisible().catch(() => false)
console.log(`  Lead in table: ${leadInTable}`)
results.leadCreated = leadInTable

if (!leadInTable) {
  // Try scrolling to find it
  await page.locator('table').first().scrollIntoViewIfNeeded().catch(() => {})
  await shot('table-scrolled')
  const retry = await page.locator('text=Test Patient Playwright').isVisible().catch(() => false)
  console.log(`  Retry after scroll: ${retry}`)
  results.leadCreated = retry
}

// ── Results ────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(50))
console.log('RESULTS:')
console.log(`  Login:           ${results.login    ? 'PASS ✓' : 'FAIL ✗'}`)
console.log(`  Clinics in DB:   ${results.hasClinics ? 'PASS ✓' : 'FAIL ✗ (no clinics)'}`)
console.log(`  OTP auto-bypass: ${results.login    ? 'PASS ✓' : 'N/A'}`)
console.log(`  Mock offer:      ${results.mockOffer ? 'PASS ✓' : 'FAIL ✗'}`)
console.log(`  Lead in table:   ${results.leadCreated ? 'PASS ✓' : 'FAIL ✗'}`)

const allPass = results.login && results.hasClinics && results.mockOffer && results.leadCreated
console.log(`\nOverall: ${allPass ? 'PASS ✓' : 'FAIL ✗'}`)
const relevantErrors = errors.filter(e => !e.includes('hydration') && !e.includes('CLIENT_FETCH'))
if (relevantErrors.length) console.log('Browser errors:', relevantErrors.slice(0, 3))
else console.log('No relevant browser errors.')
console.log(`\nScreenshots: ${SHOTS}`)
await browser.close()
process.exit(allPass ? 0 : 1)
