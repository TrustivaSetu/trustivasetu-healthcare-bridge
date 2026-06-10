import { chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const SHOTS = path.join(process.cwd(), 'test-shots')
fs.mkdirSync(SHOTS, { recursive: true })

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

// Catch every console message
page.on('console', msg => console.log(`[${msg.type()}]`, msg.text()))
page.on('pageerror', err => console.log('[PAGE ERROR]', err.message))
page.on('requestfailed', req => console.log('[REQUEST FAILED]', req.url(), req.failure()?.errorText))

// Seed localStorage first
await page.goto('http://localhost:3000/lms/login')
const emptyDb = {
  users: [], leads: [], enquiries: [], visits: [], attendance: [],
  targets: [], emiQuotes: [], comments: [], nach: [], collections: [],
  hospitals: [
    { id: 'h1', name: 'Apollo Hospital', city: 'Delhi', phone: '9999999991', stage: 'ACTIVE_PARTNER', createdAt: new Date().toISOString() }
  ]
}
await page.evaluate((db) => {
  localStorage.setItem('trustiva-user', JSON.stringify({ email: 'test@t.com', role: 'ASSOCIATE', region: 'Delhi' }))
  localStorage.setItem('trustiva-los-db', JSON.stringify(db))
}, emptyDb)

// Navigate to partner
await page.goto('http://localhost:3000/partner', { waitUntil: 'networkidle' })
await page.waitForTimeout(5000)

await page.screenshot({ path: path.join(SHOTS, 'debug3.png') })
const text = await page.locator('body').innerText().catch(() => '?')
console.log('\n--- Page text ---\n' + text.slice(0, 500))
const url = page.url()
console.log('Current URL:', url)

await browser.close()
