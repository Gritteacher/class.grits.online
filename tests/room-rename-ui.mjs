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
    await page.close();
  }
  console.log('Passed rename UI on desktop/mobile: duplicate rejection, successful rename, retained student, no overflow.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  await new Promise((resolve) => { if (server.exitCode !== null) resolve(); else server.once('exit', resolve); });
}
