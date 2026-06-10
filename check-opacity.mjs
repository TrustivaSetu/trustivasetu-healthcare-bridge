import { chromium } from '@playwright/test'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
await page.goto('http://localhost:3000/apply', { waitUntil: 'domcontentloaded', timeout: 20000 })
await page.waitForTimeout(4000)

const result = await page.evaluate(() => {
  const els = document.querySelectorAll('[style*="opacity"]')
  return Array.from(els).map(el => ({
    tag: el.tagName,
    style: el.getAttribute('style'),
    cls: el.className?.substring(0, 60),
  }))
})
console.log(JSON.stringify(result, null, 2))
await browser.close()
