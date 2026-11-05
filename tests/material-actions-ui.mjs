import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4331', '--strictPort'], {
  env: { ...process.env, VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }, stdio: 'pipe',
});
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (data) => { if (data.toString().includes('4331')) resolve(); });
    server.on('exit', (code) => reject(Error(`Vite exited ${code}`)));
  });
  browser = await chromium.launch({ channel: 'chrome' });
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1cAAAAASUVORK5CYII=', 'base64');
  for (const width of [1280, 390]) for (const role of ['teacher', 'student']) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true });
    const page = await context.newPage();
    let downloads = 0;
    let failDownload = false;
    let logs = 0;
    page.on('download', () => downloads++);
    await page.route('https://example.supabase.co/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.pathname.includes('/storage/v1/') && request.method() === 'POST') {
        await route.fulfill({ json: { signedURL: '/object/sign/classroom-files/lesson.png?token=test' } });
      } else if (url.pathname.includes('/storage/v1/')) {
        await route.fulfill({ status: failDownload ? 500 : 200, contentType: 'image/png', body: image, headers: { 'Access-Control-Allow-Origin': '*' } });
      } else {
        if (url.pathname.endsWith('/material_download_logs')) logs++;
        await route.fulfill({ json: [] });
      }
    });
    await page.goto(`http://127.0.0.1:4331/tests/material-actions-fixture.html?role=${role}`);
    await page.getByRole('button', { name: 'ดู บทเรียนทดสอบ', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('img', { name: 'lesson.png', exact: true })).toBeVisible();
    assert.equal(downloads, 0);
    assert.equal(context.pages().length, 1);
    await page.getByRole('button', { name: 'ปิด', exact: true }).click();
    const event = page.waitForEvent('download');
    await page.getByRole('button', { name: 'ดาวน์โหลด บทเรียนทดสอบ', exact: true }).click();
    const download = await event;
    assert.equal(download.suggestedFilename(), 'lesson.png');
    assert.equal(await download.failure(), null);
    assert.equal(context.pages().length, 1);
    assert.equal(logs, role === 'student' ? 2 : 0);
    failDownload = true;
    await page.getByRole('button', { name: 'ดาวน์โหลด บทเรียนทดสอบ', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('ดาวน์โหลดไฟล์ไม่สำเร็จ');
    await expect(page.getByRole('button', { name: 'ดาวน์โหลด บทเรียนทดสอบ', exact: true })).toBeEnabled();
    assert.equal(downloads, 1);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `/tmp/material-actions-${role}-${width}.png`, fullPage: true });
    await context.close();
  }
  console.log('Passed teacher/student desktop/mobile: view without downloading, named file download without new tab, access logs, failure recovery and responsive buttons.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  await new Promise((resolve) => { if (server.exitCode !== null) resolve(); else server.once('exit', resolve); });
}
