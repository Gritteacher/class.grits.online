import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4334', '--strictPort'], {
  env: { ...process.env, VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }, stdio: 'pipe',
});
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (data) => { if (data.toString().includes('4334')) resolve(); });
    server.on('exit', (code) => reject(Error(`Vite exited ${code}`)));
  });
  browser = await chromium.launch({ channel: 'chrome' });
  for (const width of [1440, 1024, 768, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto('http://127.0.0.1:4334/tests/dashboard-work-fixture.html');
    const section = page.getByRole('region', { name: 'งานที่กำลังเดินทาง' });
    const rows = section.locator('.work-item');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('3/3');
    await expect(rows.nth(0)).toContainText('1 รอตรวจ');
    await expect(rows.nth(1)).toContainText('มีคะแนน 1/1');
    await expect(section.getByLabel('กรองงานตามห้อง').locator('option')).toHaveText(['ทุกห้องเรียน','ม.6/1','ม.6/2','ม.6/10']);
    for (const row of await rows.all()) {
      const box = await row.boundingBox();
      assert.ok(box.height < 320, `Task row too tall at ${width}: ${box.height}`);
      const title = await row.locator('h3').boundingBox();
      const description = await row.locator('.work-item-description').boundingBox();
      assert.ok(title.y + title.height <= description.y + 1, 'Task text must not overlap');
    }
    await section.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `/tmp/dashboard-work-${width}.png`, fullPage: true });
    await section.getByLabel('กรองงานตามห้อง').selectOption('ม.6/2');
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0)).toContainText('1/1');
    await expect(rows.nth(0)).toContainText('ไม่มีงานรอตรวจ');
    await rows.nth(0).click();
    await expect(page.getByTestId('opened')).toHaveText('shared');
    await section.getByLabel('กรองงานตามห้อง').selectOption('ม.6/10');
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0)).toContainText('มีคะแนน 1/1');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.close();
  }
  console.log('Passed responsive work list, long titles, natural room sorting, multi-room totals, filtered counts, score-only progress and opening work.');
} finally {
  await browser?.close(); server.kill('SIGTERM');
  await new Promise((resolve) => { if (server.exitCode !== null) resolve(); else server.once('exit', resolve); });
}
