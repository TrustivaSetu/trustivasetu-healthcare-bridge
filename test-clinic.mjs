import { chromium } from 'playwright';

const BASE = 'http://localhost:3000';

async function screenshot(page, name) {
  await page.screenshot({ path: `C:/trustiva-lms/test-${name}.png`, fullPage: true });
  console.log(`📸 ${name}.png`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.setDefaultTimeout(15000);

  // ── 1: Login page ────────────────────────────────────────────
  console.log('\n=== TEST 1: Login page ===');
  await page.goto(`${BASE}/lms/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type=email]', { timeout: 10000 });
  console.log('✓ Login page loads');
  await screenshot(page, '01-login');

  // ── 2: Admin login ───────────────────────────────────────────
  console.log('\n=== TEST 2: Admin login ===');
  await page.fill('input[type=email]', 'admin@trustivasetu.com');
  await page.fill('input[type=password]', 'Rudra@1004#');
  await page.click('button[type=submit]');
  try {
    await page.waitForURL(`${BASE}/dashboard`, { timeout: 12000 });
    console.log('✓ Redirected to /dashboard');
  } catch {
    console.log('! Redirect timeout - current URL:', page.url());
  }
  await page.waitForTimeout(2000);
  await screenshot(page, '02-dashboard');

  // ── 3: Recycle Bin in sidebar ────────────────────────────────
  console.log('\n=== TEST 3: Sidebar ===');
  const recycleBinLinks = await page.locator('a:has-text("Recycle Bin")').count();
  console.log(`✓ Recycle Bin link in sidebar: ${recycleBinLinks > 0 ? 'YES' : 'NO'}`);

  // ── 4: Clinic detail page ────────────────────────────────────
  console.log('\n=== TEST 4: Clinic detail ===');
  await page.goto(`${BASE}/clinics`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  const rows = await page.locator('table tbody tr a').count();
  console.log(`  Found ${rows} clinic links`);
  
  if (rows > 0) {
    const href = await page.locator('table tbody tr a').first().getAttribute('href');
    console.log(`  First clinic href: ${href}`);
    await page.locator('table tbody tr a').first().click();
    await page.waitForTimeout(3000);
    await screenshot(page, '04-clinic-detail');
    
    const portalSection = await page.locator('text=Clinic Portal Access').count();
    console.log(`✓ "Clinic Portal Access" section: ${portalSection > 0 ? 'YES' : 'NO'}`);
    const reportSection = await page.locator('text=Monthly Report').count();
    console.log(`✓ "Monthly Report" section: ${reportSection > 0 ? 'YES' : 'NO'}`);
  }

  // ── 5: Recycle bin page ──────────────────────────────────────
  console.log('\n=== TEST 5: Recycle Bin page ===');
  await page.goto(`${BASE}/dashboard/recycle-bin`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await screenshot(page, '05-recycle-bin');
  const h1 = await page.locator('h1').first().innerText().catch(() => 'n/a');
  console.log(`✓ Page header: "${h1}"`);

  // ── 6: Route guard (admin → clinic portal) ───────────────────
  console.log('\n=== TEST 6: Route guard ===');
  await page.goto(`${BASE}/dashboard/clinic`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const afterUrl = page.url();
  console.log(`✓ Admin hitting /dashboard/clinic lands at: ${afterUrl}`);
  const guarded = !afterUrl.includes('/dashboard/clinic');
  console.log(`  Route guard working: ${guarded ? 'YES ✓' : 'NO ✗ (clinic portal shown to admin)'}`);
  await screenshot(page, '06-route-guard');

  await browser.close();
  console.log('\n✅ All tests complete');
})().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
