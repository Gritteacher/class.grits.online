import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4332', '--strictPort'], {
  env: { ...process.env, VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }, stdio: 'pipe',
});
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (data) => { if (data.toString().includes('4332')) resolve(); });
    server.on('exit', (code) => reject(Error(`Vite exited ${code}`)));
  });
  browser = await chromium.launch({ channel: 'chrome' });
  for (const width of [1920, 1440, 1024, 768, 390, 320]) for (const pending of [0, 7]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`http://127.0.0.1:4332/tests/dashboard-layout-fixture.html?pending=${pending}`);
    await expect(page.locator('.class-row')).toHaveCount(8);
    const callout = await page.locator('.review-callout').boundingBox();
    assert.ok(callout.height < 360, `Review area should remain compact at ${width}, got ${callout.height}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const first = await page.locator('.class-row').nth(0).boundingBox();
    const second = await page.locator('.class-row').nth(1).boundingBox();
    if (width > 560) { assert.equal(first.y, second.y); assert.ok(second.x > first.x); }
    else { assert.ok(second.y > first.y); }
    await expect(page.getByRole('button', { name: 'เริ่มตรวจงาน', exact: true })).toBeEnabled({ enabled: pending > 0 });
    await page.screenshot({ path: `/tmp/dashboard-${width}-${pending}.png`, fullPage: true });
    await page.close();
  }
  console.log('Passed dashboard proportions at 1920/1440/1024/768/390/320px, with empty and pending reviews: compact callout, responsive room columns, no overflow.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  await new Promise((resolve) => { if (server.exitCode !== null) resolve(); else server.once('exit', resolve); });
}
