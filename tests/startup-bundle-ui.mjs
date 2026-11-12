import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const server = spawn('node', ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '4351', '--strictPort'], { stdio: 'pipe' });
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.on('data', data => { if (data.toString().includes('4351')) resolve(); });
    server.on('exit', code => reject(Error(`Preview exited ${code}`)));
  });
  browser = await chromium.launch({ channel: 'chrome' });
  for (const width of [1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const scripts = [], errors = [];
    page.on('request', r => { if (r.resourceType() === 'script') scripts.push(r.url()); });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:4351/');
    await expect(page.getByRole('button', { name: 'เข้าสู่ระบบนักเรียน', exact: true })).toBeVisible();
    assert(!scripts.some(url => /xlsx|RosterPage|ReportsPage/.test(url)), 'Excel and management tools must not load on entry');
    assert.equal(errors.length, 0, errors.join('\n'));
    await page.screenshot({ path: `/tmp/classroom-startup-${width}.png`, fullPage: true });
    console.log(`PASS built startup ${width}px: ${scripts.length} script(s), no Excel/roster/report chunk`);
    await page.close();
  }
} finally {
  await browser?.close();
  server.kill();
}
