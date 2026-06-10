import { chromium } from '@playwright/test'
import fs from 'fs'

if (!fs.existsSync('test-shots')) fs.mkdirSync('test-shots')

const browser = await chromium.launch({ headless: false, slowMo: 60 })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

page.on('pageerror', e => console.log('[PAGE ERROR]', e.message))

// Helper: set a React-controlled input value reliably
async function reactFill(selector, value) {
  await page.waitForSelector(selector, { timeout: 8000 })
  const el = page.locator(selector)
  await el.click()
  // Try fill() first — works when React events are attached
  await el.fill(value)
  // Also dispatch native events to ensure React state syncs
  await page.evaluate(({ sel, val }) => {
    const input = document.querySelector(sel)
    if (!input) return
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    nativeSetter.call(input, val)
    input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
    input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))
  }, { sel: selector, val: value })
  await page.waitForTimeout(200)
}

// ── NAVIGATE ───────────────────────────────────────────────
await page.goto('http://localhost:3000/apply', { timeout: 90000, waitUntil: 'networkidle' })
await page.waitForTimeout(2000)
console.log('Loaded /apply')

// ── STEP 1 ─────────────────────────────────────────────────
await page.locator('input[placeholder="e.g. Apollo Hospitals, City Care Clinic"]').fill('Apollo Hospitals')
await page.locator('input[placeholder="Enter your full name"]').fill('Ramesh Kumar')

// Mobile — use native setter trick since type="text" with no default value
await page.evaluate((val) => {
  const input = document.querySelector('input[placeholder="10-digit mobile number"]')
  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
  nativeSetter.call(input, val)
  input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
  input.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))
  const propsKey = Object.keys(input).find(k => k.startsWith('__reactProps'))
  if (propsKey && input[propsKey]?.onChange) {
    input[propsKey].onChange({ target: input, currentTarget: input, bubbles: true, nativeEvent: new Event('change') })
  }
}, '9876543210')
await page.waitForTimeout(500)

await page.getByRole('button', { name: /Send OTP/i }).click()
await page.waitForSelector('input[maxlength="1"]', { timeout: 6000 })
console.log('Step 1: OTP inputs appeared')

const otpInputs = await page.locator('input[maxlength="1"]').all()
for (let i = 0; i < Math.min(otpInputs.length, 6); i++) {
  await otpInputs[i].fill(String(i + 1))
  await page.waitForTimeout(80)
}
await page.waitForSelector('text=Mobile verified', { timeout: 6000 })
console.log('Step 1: Mobile verified ✓')

await page.locator('input#tc').check()
await page.locator('input[placeholder="e.g. 500000"]').fill('500000')
await page.waitForTimeout(300)

await page.screenshot({ path: 'test-shots/step1-done.png', fullPage: true })
await page.getByRole('button', { name: /Continue →/i }).click()
await page.waitForTimeout(1000)
console.log('Step 1 → Step 2 ✓')

// ── STEP 2 ─────────────────────────────────────────────────
await page.waitForSelector('input[placeholder="ABCDE1234F"]', { timeout: 8000 })
console.log('Step 2 loaded')

// PAN — fill and wait for auto-verify
await page.locator('input[placeholder="ABCDE1234F"]').fill('ABCDE1234F')
await page.waitForSelector('text=PAN Verified', { timeout: 6000 })
console.log('Step 2: PAN verified ✓')

// Employment type — click Salaried
await page.locator('label').filter({ hasText: 'Salaried' }).click()
await page.waitForTimeout(300)

// Email
await page.locator('input[placeholder="yourname@example.com"]').fill('ramesh@example.com')

// Monthly income — use fill directly (type="number" input)
await page.locator('input[placeholder="e.g. 75000"]').fill('75000')

// Company name
await page.locator('input[placeholder="e.g. Infosys Ltd."]').fill('Infosys Ltd')

// Office PIN Code
await page.locator('input[placeholder="6-digit PIN"]').fill('400001')
await page.waitForSelector('input[value="Mumbai, Maharashtra"]', { timeout: 4000 }).catch(() =>
  page.waitForTimeout(2000)
)

await page.screenshot({ path: 'test-shots/step2-done.png', fullPage: true })
await page.getByRole('button', { name: /Continue →/i }).click()
await page.waitForTimeout(1000)
console.log('Step 2 → Step 3 ✓')

// ── STEP 3 ─────────────────────────────────────────────────
await page.waitForSelector('text=Current Address', { timeout: 8000 })
console.log('Step 3 loaded')

// Current address
await page.locator('input[placeholder="e.g. A-402, 3rd Floor"]').first().fill('B-204')
await page.locator('input[placeholder="e.g. MG Road, Koramangala"]').first().fill('Linking Road, Bandra')
await page.locator('input[placeholder="e.g. Near City Mall"]').first().fill('Near Bandra Kurla Complex')

// Current PIN — wait for city auto-fill
await page.locator('input[placeholder="6-digit PIN"]').first().fill('400051')
await page.waitForTimeout(2000)

await page.screenshot({ path: 'test-shots/step3.png', fullPage: true })

// Tick "Same as current address"
await page.locator('input[type="checkbox"]').filter({ visible: true }).click()
await page.waitForTimeout(300)
console.log('Step 3: Same address checked')

await page.screenshot({ path: 'test-shots/step3-done.png', fullPage: true })
await page.getByRole('button', { name: /Continue →/i }).click()
await page.waitForTimeout(1000)
console.log('Step 3 → Step 4 ✓')

// ── STEP 4 ─────────────────────────────────────────────────
await page.waitForSelector('text=Your Loan Offer', { timeout: 12000 }).catch(() =>
  page.waitForSelector('.animate-pulse', { timeout: 12000 })
)
console.log('Step 4: Offer loading...')

// Wait for skeleton to resolve to offer card (up to 5s)
await page.waitForFunction(() => {
  const h = Array.from(document.querySelectorAll('h2,h3')).map(e => e.textContent)
  return h.some(t => t?.includes('₹') || t?.includes('Loan Offer'))
}, { timeout: 8000 }).catch(() => console.log('Offer may still be loading'))

await page.screenshot({ path: 'test-shots/step4-offer.png', fullPage: true })
console.log('Step 4: Offer card screenshot')

// Look for Accept Offer button / tab
const acceptBtn = page.getByRole('button', { name: /Accept Offer/i })
  .or(page.locator('button').filter({ hasText: /Accept Offer/i }))
if (await acceptBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
  console.log('Accept Offer visible')
  // Don't click — just screenshot
} else {
  // Look for tabs
  const tabs = await page.locator('[role="tab"], button').filter({ hasText: /Accept|Enhancement/i }).all()
  console.log('Offer tabs/buttons found:', tabs.length)
}

await page.screenshot({ path: 'test-shots/step4-final.png', fullPage: true })
console.log('All screenshots saved to test-shots/')

await browser.close()
console.log('Done.')
