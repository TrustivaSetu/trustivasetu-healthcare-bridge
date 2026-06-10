import { chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const SHOTS = path.join(process.cwd(), 'test-shots')
fs.mkdirSync(SHOTS, { recursive: true })

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

page.on('console', msg => console.log(`[browser ${msg.type()}]`, msg.text()))
page.on('response', r => {
  if (r.url().includes('los/db')) console.log(`[fetch] ${r.url()} -> ${r.status()}`)
})

// Mock /api/los/db to return empty DB (bypasses auth issue)
await ctx.route('**/api/los/db', async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      users: [],
      hospitals: [
        { id: 'h1', name: 'Apollo Hospital', city: 'Delhi', phone: '9999999991', stage: 'ACTIVE_PARTNER', createdAt: new Date().toISOString() }
      ],
      leads: [], enquiries: [], visits: [], attendance: [],
      targets: [], emiQuotes: [], comments: [], nach: [], collections: []
    })
  })
})

// Seed localStorage then navigate
await page.goto('http://localhost:3000/lms/login')
await page.evaluate(() => {
  localStorage.setItem('trustiva-user', JSON.stringify({
    email: 'test@trustivasetu.com', role: 'ASSOCIATE', region: 'Delhi',
  }))
})

await page.goto('http://localhost:3000/partner', { waitUntil: 'domcontentloaded' })

// Wait up to 15s for loading to finish
let loaded = false
for (let i = 0; i < 15; i++) {
  await page.waitForTimeout(1000)
  const text = await page.locator('body').innerText().catch(() => '')
  const hasLoading = text.includes('Loading Trustiva LOS')
  const hasButton = await page.locator('button').count()
  console.log(`t+${i+1}s: loading=${hasLoading}, buttons=${hasButton}`)
  if (!hasLoading && hasButton > 0) { loaded = true; break }
}

await page.screenshot({ path: path.join(SHOTS, 'debug2-final.png') })
const text = await page.locator('body').innerText().catch(() => '?')
console.log('\nPage text preview:', text.slice(0, 400))

const buttons = await page.locator('button').all()
console.log(`Buttons found: ${buttons.length}`)
for (const b of buttons.slice(0, 10)) {
  const t = (await b.textContent())?.trim()
  if (t) console.log('  button:', t)
}

console.log(`\nLoaded: ${loaded}`)
await browser.close()
