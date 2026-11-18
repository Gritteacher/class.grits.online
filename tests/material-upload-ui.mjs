import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const server = spawn('node', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4353', '--strictPort'], {
  env: { ...process.env, VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'test' }, stdio: 'pipe',
});
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.on('data', d => { if (d.toString().includes('4353')) resolve(); });
    server.on('exit', reject);
  });
  browser = await chromium.launch({ channel: 'chrome' });
  for (const width of [1280, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 950 } });
    await page.addInitScript(() => {
      window.uploads = [];
      window.XMLHttpRequest = class {
        upload = {}; headers = {}; status = 0;
        open(method, url) { this.method = method; this.url = url; }
        setRequestHeader(key, value) { this.headers[key] = value; }
        send(body) { this.body = body; window.uploads.push(this); }
      };
    });
    let finishSave;
    const save = new Promise(resolve => { finishSave = resolve; });
    let inserts = 0;
    await page.route('https://example.supabase.co/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.includes('/object/upload/sign/')) return route.fulfill({ json: { url: `${url.pathname.replace('/storage/v1', '')}?token=test` } });
      if (url.pathname.endsWith('/classrooms')) return route.fulfill({ json: [{ id: 'r1', room: '1', name: 'ม.6/1', teacher_id: 'teacher' }] });
      if (url.pathname.endsWith('/materials') && route.request().method() === 'POST') {
        inserts++;
        await save;
        return route.fulfill({ json: { ...route.request().postDataJSON(), id: 'new-material', created_at: '2026-11-18T00:00:00Z' } });
      }
      return route.fulfill({ json: [] });
    });
    await page.goto('http://127.0.0.1:4353/tests/material-actions-fixture.html?role=teacher');
    await page.getByRole('button', { name: 'เพิ่มสื่อ', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'เพิ่มสื่อการสอน' });
    await dialog.getByLabel('ชื่อสื่อ').fill('เอกสารทดสอบ');
    await dialog.getByRole('checkbox', { name: 'ม.6/1' }).check();
    await dialog.locator('input[type=file]').setInputFiles({ name: 'lesson.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') });
    await dialog.getByRole('button', { name: 'อัปโหลด', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.uploads.length)).toBe(1);
    const progress = dialog.getByRole('progressbar', { name: 'ความคืบหน้าการอัปโหลดสื่อ' });
    await expect(progress).toHaveAttribute('value', '0');
    await page.evaluate(() => window.uploads[0].upload.onprogress({ lengthComputable: true, loaded: 40, total: 100 }));
    await expect(progress).toHaveAttribute('value', '40');
    await expect(dialog.getByText('40%', { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('ชื่อสื่อ')).toBeDisabled();
    await dialog.getByRole('button', { name: 'ปิดหน้าต่าง' }).click();
    await expect(dialog).toBeVisible();
    await page.screenshot({ path: `/tmp/material-upload-${width}.png`, fullPage: true });
    const format = await page.evaluate(() => {
      const x = window.uploads[0];
      return { method: x.method, signed: x.url.includes('token=test'), cache: x.body.get('cacheControl'), name: x.body.get('').name, upsert: x.headers['x-upsert'] };
    });
    assert.deepEqual(format, { method: 'PUT', signed: true, cache: '3600', name: 'lesson.pdf', upsert: 'false' });
    await page.evaluate(() => window.uploads[0].onerror());
    await expect(dialog.getByRole('alert')).toContainText('การเชื่อมต่อขัดข้อง');
    await expect(dialog.getByLabel('ชื่อสื่อ')).toHaveValue('เอกสารทดสอบ');
    assert.equal(inserts, 0, 'Failed upload must not publish a material');
    await dialog.getByRole('button', { name: 'อัปโหลด', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.uploads.length)).toBe(2);
    await page.evaluate(() => window.uploads[1].upload.onprogress({ lengthComputable: false }));
    assert.equal(await progress.getAttribute('value'), null, 'Unknown total must not display a fake percentage');
    await page.evaluate(() => window.uploads[1].upload.onprogress({ lengthComputable: true, loaded: 100, total: 100 }));
    await expect(progress).toHaveAttribute('value', '99');
    await page.evaluate(() => { window.uploads[1].status = 200; window.uploads[1].onload(); });
    await expect(dialog.getByText('อัปโหลดครบแล้ว กำลังบันทึกข้อมูล')).toBeVisible();
    await expect(progress).toHaveAttribute('value', '100');
    finishSave();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'เอกสารทดสอบ' })).toBeVisible();
    assert.equal(inserts, 1);
    await page.close();
  }
  console.log('PASS: 320/390/1280px actual byte events, indeterminate progress, server confirmation, saving state, upload failure and retry without losing form');
} finally {
  await browser?.close();
  server.kill();
}
