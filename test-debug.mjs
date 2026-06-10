import { chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const SHOTS = path.join(process.cwd(), 'test-shots')
fs.mkdirSync(SHOTS, { recursive: true })

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()

page.on('console', msg => console.log(`[browser ${msg.type()}]`, msg.text()))

await page.goto('http://localhost:3000/partner')
await page.evaluate(() => {
  localStorage.setItem('trustiva-user', JSON.stringify({
    email: 'test@trustivasetu.com', role: 'ASSOCIATE', region: 'Delhi',
  }))
})
await page.reload()
await page.waitForSelector('text=Trustiva LOS', { timeout: 20000 })
await page.waitForTimeout(3000)  // extra wait for React to finish rendering
await page.screenshot({ path: path.join(SHOTS, 'debug-after-load.png') })

// Print all visible button texts
const buttons = await page.locator('button').all()
console.log(`\nFound ${buttons.length} buttons:`)
for (const btn of buttons) {
  const txt = (await btn.textContent())?.trim()
  if (txt) console.log('  button:', txt)
}

// Print all visible text
const content = await page.textContent('body')
console.log('\nBody text (first 500 chars):', content?.slice(0, 500))

await browser.close()
