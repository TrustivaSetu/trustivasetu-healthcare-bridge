import { chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const BASE = 'http://localhost:3000'
const SHOTS = path.join(process.cwd(), 'test-shots')
fs.mkdirSync(SHOTS, { recursive: true })

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

const consoleErrors = []
page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })

let step = 0
async function shot(label) {
  step++
  const file = path.join(SHOTS, `${String(step).padStart(2,'0')}-${label}.png`)
  await page.screenshot({ path: file, fullPage: false })
  console.log(`  [screenshot] ${file}`)
}

// Step 1 — seed localStorage BEFORE navigating to /partner
// Go to any page on the origin first so we have a document to eval against
await page.goto(BASE + '/lms/login')
await page.evaluate(() => {
  localStorage.setItem('trustiva-user', JSON.stringify({
    email: 'test@trustivasetu.com',
    role: 'ASSOCIATE',
    region: 'Delhi',
  }))
})
// Now navigate to /partner — AuthGate will find the key and NOT redirect
await page.goto(BASE + '/partner', { waitUntil: 'domcontentloaded' })

// Wait until the LOS finishes loading (sidebar buttons appear)
await page.waitForFunction(() => {
  return document.querySelector('button') !== null &&
         document.body.innerText.includes('Trustiva LOS') &&
         !document.body.innerText.includes('Loading Trustiva LOS')
}, { timeout: 20000 })

console.log('1. LOS dashboard loaded and sidebar ready')
await shot('los-dashboard')

// Step 2 — navigate to Create Lead
await page.click('button:has-text("Create Lead")')
await page.waitForSelector('text=Patient Enquiry Registration', { timeout: 8000 })
console.log('2. Create Lead module open')
await shot('create-lead-form')

// Step 3 — fill the form fields (scope to the step-1 panel to avoid sidebar search input)
const panel = page.locator('.bg-white\\/5.border.border-white\\/10.rounded-2xl.p-6').first()

// Enquiry category (first select inside panel)
await panel.locator('select').nth(0).selectOption('IPD')
// Mobile (only input with maxLength=10)
await panel.locator('input[maxlength="10"]').fill('9876543210')
// Guardian name (first non-number, non-maxlength text input inside panel)
await panel.locator('input:not([type="number"]):not([maxlength="10"])').nth(0).fill('Sunita Devi')
// Patient name (second such input)
await panel.locator('input:not([type="number"]):not([maxlength="10"])').nth(1).fill('Raj Kumar')
// Hospital (second select in panel)
const hospitalSelect = panel.locator('select').nth(1)
const opts = await hospitalSelect.locator('option').all()
if (opts.length > 1) {
  const val = await opts[1].getAttribute('value')
  if (val) await hospitalSelect.selectOption(val)
}
// Medical estimate
await panel.locator('input[type="number"]').first().fill('75000')
// Financing required (third select in panel)
await panel.locator('select').nth(2).selectOption('Yes')

await page.waitForTimeout(300)
console.log('3. Form filled')
await shot('form-filled')

// Check button state
const sendBtn = page.locator('button:has-text("Create Enquiry & Send OTP")')
const isEnabled = await sendBtn.isEnabled()
console.log(`   Send OTP button enabled: ${isEnabled}`)

// Step 4 — open OTP modal
await sendBtn.click()
await page.waitForSelector('text=OTP sent to', { timeout: 8000 })
console.log('4. OTP modal appeared')
await shot('otp-modal')

// Step 5 — enter 123456 and verify
await page.locator('.fixed input[maxlength="6"]').fill('123456')
await shot('otp-entered')
await page.click('button:has-text("Verify OTP")')
await page.waitForTimeout(3000)
console.log('5. OTP submitted, waiting for decision card...')

// Step 6 — decision card
const decisionCard = page.locator('text=Salary Eligibility Check')
const decisionVisible = await decisionCard.isVisible().catch(() => false)
console.log(`   Decision card visible: ${decisionVisible}`)
await shot('after-otp')

if (!decisionVisible) {
  console.log('   ERROR: Decision card did not appear. Checking page content...')
  const bodyText = await page.locator('body').innerText()
  console.log('   Body preview:', bodyText.slice(0, 300))
  await browser.close()
  process.exit(1)
}

const salaryInput = page.locator('input[type="number"]').last()

// REJECTED (< 25000)
await salaryInput.fill('15000')
await page.waitForTimeout(400)
const rejectedOk = await page.locator('text=Rejected').isVisible().catch(() => false)
console.log(`   REJECTED (₹15,000): ${rejectedOk}`)
await shot('decision-rejected')

// CONDITIONAL (25000–49999)
await salaryInput.fill('30000')
await page.waitForTimeout(400)
const conditionalOk = await page.locator('text=Conditional Approval').isVisible().catch(() => false)
console.log(`   CONDITIONAL (₹30,000): ${conditionalOk}`)
await shot('decision-conditional')

// APPROVED (>= 50000)
await salaryInput.fill('60000')
await page.waitForTimeout(400)
const approvedOk = await page.locator('text=Approved').isVisible().catch(() => false)
const disclaimerOk = await page.locator('text=Testing Mode').isVisible().catch(() => false)
const reasonOk = await page.locator('text=Decision based on salary eligibility').isVisible().catch(() => false)
console.log(`   APPROVED (₹60,000): ${approvedOk}`)
console.log(`   Testing Mode disclaimer: ${disclaimerOk}`)
console.log(`   Reason text: ${reasonOk}`)
await shot('decision-approved')

// Step 7 — continue to application
await page.click('button:has-text("Continue to Application")')
await page.waitForTimeout(1000)
const step2Ok = await page.locator('text=Address Details').isVisible().catch(() => false)
console.log(`6. Reached Step 2 (Address Details): ${step2Ok}`)
await shot('step2-address')

// Results
console.log('\n--- TEST RESULTS ---')
const allPass = decisionVisible && rejectedOk && conditionalOk && approvedOk && disclaimerOk && reasonOk && step2Ok
console.log(`Overall: ${allPass ? 'PASS ✓' : 'FAIL ✗'}`)
if (consoleErrors.length) console.log('Browser errors:', consoleErrors.slice(0, 5))
else console.log('No browser console errors.')

await browser.close()
console.log(`\nScreenshots: ${SHOTS}`)
process.exit(allPass ? 0 : 1)
