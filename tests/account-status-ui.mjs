import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4340', '--strictPort'], {
  env: { ...process.env, VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'test' }, stdio: 'pipe',
});
let browser;
try {
  await new Promise((resolve, reject) => { server.stdout.on('data', d => { if (d.toString().includes('4340')) resolve(); }); server.on('exit', code => reject(Error(`Vite exited ${code}`))); });
  browser = await chromium.launch({ channel: 'chrome' });
  for (const width of [1280, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 1100 } });
    let failure = false;
    await page.route('**/api/student-account-status', async route => {
      assert.ok(route.request().headers().authorization);
      if (failure) return route.fulfill({ status: 503, json: { error: 'โหลดสถานะบัญชีไม่สำเร็จ' } });
      await new Promise(resolve => setTimeout(resolve, 150));
      return route.fulfill({ json: { students: [
        { id: 'student-0', registeredAt: '2026-11-05T02:00:00Z', lastSignInAt: '2026-11-06T02:00:00Z', loginStatusKnown: true },
        { id: 'student-1', registeredAt: null, lastSignInAt: null, loginStatusKnown: true },
        { id: 'student-2', registeredAt: null, lastSignInAt: null, loginStatusKnown: false },
        { id: 'student-3', registeredAt: '2026-11-05T02:00:00Z', lastSignInAt: null, loginStatusKnown: true },
      ] } });
    });
    await page.goto('http://127.0.0.1:4340/tests/account-status-fixture.html');
    await expect(page.getByText('เคยเข้าสู่ระบบแล้ว', { exact: true })).toBeVisible();
    await expect(page.getByText('ลงทะเบียนแล้ว', { exact: true })).toHaveCount(2);
    await expect(page.getByText('ยังไม่เคยเข้าสู่ระบบ', { exact: true })).toHaveCount(2);
    await expect(page.getByText('ตรวจสอบการเข้าใช้ไม่ได้', { exact: true })).toHaveCount(1);
    await expect(page.getByText(/เข้าใช้ล่าสุด/)).toContainText('09:00');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const overlaps = await page.locator('.roster-person').evaluateAll(rows => rows.some(row => {
      const name = row.querySelector('.roster-person-name').getBoundingClientRect();
      const actions = row.querySelector('.roster-person-actions').getBoundingClientRect();
      return name.right > actions.left + 1;
    }));
    assert.equal(overlaps, false);
    await page.screenshot({ path: `/tmp/account-status-${width}.png`, fullPage: true });
    failure = true;
    await page.getByRole('button', { name: 'อัปเดตสถานะบัญชี' }).click();
    await expect(page.getByRole('alert')).toHaveText('โหลดสถานะบัญชีไม่สำเร็จ');
    await expect(page.getByText('ยังตรวจสอบสถานะบัญชีไม่ได้', { exact: true })).toHaveCount(4);
    await expect(page.getByText('ยังไม่เคยเข้าสู่ระบบ', { exact: true })).toHaveCount(0);
    failure = false;
    await page.getByRole('button', { name: 'อัปเดตสถานะบัญชี' }).click();
    await expect(page.getByText('เคยเข้าสู่ระบบแล้ว', { exact: true })).toBeVisible();
    await page.close();
  }
  console.log('Passed account status badges, Bangkok timestamp, unknown/failure recovery and desktop/mobile layouts.');
} finally { await browser?.close(); server.kill(); }
