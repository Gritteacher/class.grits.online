import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4329', '--strictPort'], {
  env: { ...process.env, VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }, stdio: 'pipe',
});
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (data) => { if (data.toString().includes('4329')) resolve(); });
    server.on('exit', (code) => reject(Error(`Vite exited ${code}`)));
  });
  browser = await chromium.launch({ channel: 'chrome' });
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const routes = [];
    let image;
    await page.route('**/activity-test-data', (route) => { routes.push(route); });
    await page.route('**/storage/v1/object/test/file.png', (route) => { routes.push(route); });
    await page.route('**/activity-image.png', (route) => { image = route; });
    await page.goto('http://127.0.0.1:4329/tests/activity-fixture.html', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('status', { name: 'กำลังโหลดตัวอย่างไฟล์' })).toBeVisible();
    await expect.poll(() => Boolean(image)).toBe(true);
    await image.abort();
    await expect(page.getByText('โหลดตัวอย่างไม่สำเร็จ')).toBeVisible();
    await page.getByRole('button', { name: 'โหลดข้อมูล', exact: true }).click();
    await expect(page.locator('.activity-status.floating')).toHaveText('กำลังโหลดข้อมูล');
    await page.getByRole('button', { name: 'อัปโหลดไฟล์', exact: true }).click();
    await expect(page.locator('.activity-status.floating')).toHaveText('กำลังอัปโหลดไฟล์');
    await expect(page.locator('.activity-status .loading-spinner')).toHaveCSS('animation-name', 'loading-spin');
    await routes.shift().fulfill({ json: {} });
    await expect(page.locator('.activity-status.floating')).toHaveText('กำลังอัปโหลดไฟล์');
    await routes.shift().fulfill({ json: {} });
    await expect(page.locator('.activity-status')).toHaveCount(0);
    await page.getByRole('button', { name: 'เปิดหน้าต่าง' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'อัปโหลดไฟล์', exact: true }).click();
    await expect(dialog.locator('.activity-status.inline')).toHaveText('กำลังอัปโหลดไฟล์');
    await page.screenshot({ path: `/tmp/activity-upload-${width}.png`, fullPage: true });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(dialog.locator('.loading-spinner')).toHaveCSS('animation-name', 'none');
    await routes.shift().fulfill({ status: 500, json: { error: 'failed' } });
    await expect(dialog.getByTestId('result')).toHaveText('ไม่สำเร็จ');
    await expect(dialog.locator('.activity-status')).toHaveCount(0);
    await page.close();
  }
  console.log('Passed desktop/mobile loading/upload animation, concurrent requests, modal indicator, reduced motion, image and request failure cleanup.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  await new Promise((resolve) => { if (server.exitCode !== null) resolve(); else server.once('exit', resolve); });
}
