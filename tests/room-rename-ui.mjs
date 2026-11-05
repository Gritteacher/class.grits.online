import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4328', '--strictPort'], {
  env: { ...process.env, VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' },
  stdio: 'pipe',
});
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (data) => { if (data.toString().includes('4328')) resolve(); });
    server.on('exit', (code) => reject(new Error(`Vite exited ${code}`)));
  });
  browser = await chromium.launch({ channel: 'chrome' });
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto('http://127.0.0.1:4328/tests/room-rename-fixture.html');
    await page.getByRole('button', { name: 'แก้ไขชื่อห้องเรียน', exact: true }).click();
    await page.getByLabel('ชื่อห้องเรียน', { exact: true }).fill('ม.6/2');
    await page.getByRole('button', { name: 'บันทึกชื่อห้อง', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'มีชื่อห้องเรียนนี้แล้ว' }).waitFor();
    await page.getByLabel('ชื่อห้องเรียน', { exact: true }).fill('ห้องสังคม 6/1');
    await page.getByRole('button', { name: 'บันทึกชื่อห้อง', exact: true }).click();
    await page.getByRole('heading', { name: 'ห้องเรียน ห้องสังคม 6/1', exact: true }).waitFor();
    await page.getByText('นักเรียนทดสอบ', { exact: true }).waitFor();
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `/tmp/room-rename-${width}.png`, fullPage: true });
    await page.goto('http://127.0.0.1:4328/tests/duplicate-room-fixture.html');
    const cards = page.locator('.roster-room');
    await cards.nth(1).waitFor();
    assert.deepEqual(await cards.locator('small:last-child').allTextContents(), ['1 คน', '0 คน', '0 คน']);
    await cards.nth(1).click();
    assert.equal(await page.locator('.roster-room.active').count(), 1);
    await page.getByLabel('ลบห้องเรียนนี้', { exact: true }).click();
    await page.getByRole('button', { name: 'ยืนยัน ลบห้อง', exact: true }).click();
    await page.getByTestId('deleted').filter({ hasText: 'r2' }).waitFor();
    assert.equal(await cards.count(), 2);
    await cards.nth(0).click();
    await page.getByText('นักเรียนห้องเดิม', { exact: true }).waitFor();
    await page.reload();
    await cards.nth(0).click();
    await page.getByLabel('ลบห้องเรียนนี้', { exact: true }).click();
    await page.getByRole('button', { name: 'ยืนยัน ลบห้อง', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'ยังมีรายชื่อ' }).waitFor();
    assert.equal(await cards.count(), 3);
    await page.close();
  }
  console.log('Passed desktop/mobile: rename, duplicate-room selection, per-room counts, exact-room deletion, occupied-room protection and retained students.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  await new Promise((resolve) => { if (server.exitCode !== null) resolve(); else server.once('exit', resolve); });
}
