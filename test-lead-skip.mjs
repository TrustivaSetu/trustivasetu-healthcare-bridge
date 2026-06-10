import { chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const BASE = 'http://localhost:3000'
const SHOTS = path.join(process.cwd(), 'test-shots-lead')
fs.mkdirSync(SHOTS, { recursive: true })

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }) // mobile viewport
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

// ── Test 1: Skip button on form step ─────────────────────────────────────────
console.log('\n=== Test 1: ⚡ Skip OTP (Dev Mode) button ===')
await page.goto(BASE + '/lead', { waitUntil: 'networkidle' })
await page.waitForSelector('text=Apply for Medical Loan', { timeout: 10000 })
console.log('1. Form loaded')
await shot('form-loaded')

// Dismiss cookie consent banner if present
const cookieBanner = page.locator('[role="dialog"][aria-label="Cookie consent"]')
if (await cookieBanner.isVisible().catch(() => false)) {
  const acceptBtn = cookieBanner.locator('button').last()
  await acceptBtn.click()
  await page.waitForTimeout(300)
  console.log('   Cookie banner dismissed')
}

// Confirm yellow testing mode hint visible
const hintVisible = await page.locator('text=Testing Mode').first().isVisible().catch(() => false)
console.log(`   Yellow hint visible: ${hintVisible}`)

// Confirm skip button visible
const skipVisible = await page.locator('button:has-text("Skip OTP")').isVisible().catch(() => false)
console.log(`   Skip button visible: ${skipVisible}`)
await shot('form-with-skip-button')

// Click skip using JS evaluation to bypass cookie banner overlay
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Skip OTP'))
  btn?.click()
})
await page.waitForSelector('text=Application Submitted', { timeout: 5000 })
console.log('2. Success screen reached in 1 click')
await shot('success-screen')

// Confirm DEV reference ID
const refText = await page.locator('text=DEV-').isVisible().catch(() => false)
console.log(`   DEV-* reference ID shown: ${refText}`)

// ── Test 2: OTP step pre-filled with 123456 ──────────────────────────────────
// Need a clinic to reach the OTP step via real "Send OTP" button
// We'll mock the API calls to test the OTP-step path
console.log('\n=== Test 2: OTP step pre-fill (via URL mock) ===')

// Intercept clinic API to return a fake clinic
await ctx.route('**/api/public/clinic/**', route =>
  route.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify({ data: { id: 'c1', name: 'Test Clinic', externalId: 'TC1', address: 'Delhi' } }) })
)
// Intercept OTP send to return ok
await ctx.route('**/api/public/otp/send', route =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) })
)

await page.goto(BASE + '/lead?clinic=TC1', { waitUntil: 'networkidle' })
await page.waitForSelector('text=Test Clinic', { timeout: 8000 })
console.log('3. Form with mocked clinic loaded')
await shot('form-with-clinic')

// Fill required fields
await page.fill('input[placeholder="As per Aadhaar card"]', 'Raj Kumar')
await page.fill('input[placeholder="10-digit number"]', '9876543210')
await page.fill('input[type="number"]', '50000')
await page.check('input[type="checkbox"]')

// Click real "Verify Mobile & Continue →"
await page.click('button:has-text("Verify Mobile & Continue")')
await page.waitForSelector('text=Verify Your Mobile', { timeout: 8000 })
console.log('4. OTP step reached via real Send OTP button')
await shot('otp-step')

// Confirm testing hint on OTP step
const otpHint = await page.locator('text=pre-filled with').isVisible().catch(() => false)
console.log(`   OTP step hint visible: ${otpHint}`)

// Confirm input is pre-filled with 123456
const otpInput = page.locator('input[type="tel"]')
const otpVal = await otpInput.inputValue()
console.log(`   OTP input value: "${otpVal}" (expected: "123456")`)
await shot('otp-prefilled')

// Click Submit → should bypass verify API and go to done
await page.click('button:has-text("Submit Application")')
await page.waitForSelector('text=Application Submitted', { timeout: 5000 })
console.log('5. OTP step bypassed → success screen')
await shot('otp-success')

const devRef2 = await page.locator('text=DEV-').isVisible().catch(() => false)
console.log(`   DEV-* reference ID: ${devRef2}`)

// ── Results ──────────────────────────────────────────────────────────────────
console.log('\n--- RESULTS ---')
const pass = hintVisible && skipVisible && refText && otpHint && otpVal === '123456' && devRef2
console.log(`Overall: ${pass ? 'PASS ✓' : 'FAIL ✗'}`)
if (errors.length) console.log('Errors:', errors.slice(0, 3))
else console.log('No browser errors.')

await browser.close()
console.log(`\nScreenshots: ${SHOTS}`)
process.exit(pass ? 0 : 1)
