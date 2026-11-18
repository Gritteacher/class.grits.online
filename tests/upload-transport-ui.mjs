import { chromium, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

let release, received;
const responseReady = new Promise(resolve => { release = resolve; });
const uploadServer = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:4354');
  res.setHeader('Access-Control-Allow-Methods', 'PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'x-upsert');
  if (req.method === 'OPTIONS') { res.writeHead(204).end(); return; }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  received = { method: req.method, headers: req.headers, body: Buffer.concat(chunks) };
  if (req.url === '/denied') { res.writeHead(403).end('{}'); return; }
  await responseReady;
  res.writeHead(200, { 'Content-Type': 'application/json' }).end('{}');
});
await new Promise(resolve => uploadServer.listen(0, '127.0.0.1', resolve));
const port = uploadServer.address().port;
const vite = spawn('node', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4354', '--strictPort'], {
  env: { ...process.env, VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'test' }, stdio: 'pipe',
});
let browser;
try {
  await new Promise((resolve, reject) => {
    vite.stdout.on('data', d => { if (d.toString().includes('4354')) resolve(); });
    vite.on('exit', reject);
  });
  browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4354/');
  await page.evaluate(async port => {
    const { uploadWithProgress } = await import('/src/lib/uploadWithProgress.ts');
    window.progressEvents = [];
    window.file = new File(['%PDF-1.4\n' + 'test data'.repeat(10000)], 'lesson.pdf', { type: 'application/pdf' });
    window.result = uploadWithProgress(`http://127.0.0.1:${port}/upload?token=local-test`, window.file, percent => window.progressEvents.push(percent));
  }, port);
  await expect.poll(() => page.evaluate(() => window.progressEvents.at(-1))).toBe(99);
  assert.equal(received.method, 'PUT');
  assert.equal(received.headers['x-upsert'], 'false');
  assert.match(received.headers['content-type'], /^multipart\/form-data; boundary=/);
  const body = received.body.toString();
  assert(body.includes('name="cacheControl"\r\n\r\n3600'));
  assert(body.includes('name=""; filename="lesson.pdf"'));
  assert(body.includes('Content-Type: application/pdf'));
  release();
  await page.evaluate(() => window.result);
  assert.equal(await page.evaluate(() => window.progressEvents.at(-1)), 100);
  const failure = await page.evaluate(async port => {
    const { uploadWithProgress } = await import('/src/lib/uploadWithProgress.ts');
    try { await uploadWithProgress(`http://127.0.0.1:${port}/denied`, window.file, () => {}); return ''; }
    catch (error) { return error.message; }
  }, port);
  assert.match(failure, /อัปโหลดไฟล์สื่อไม่สำเร็จ/);
  console.log('PASS real cross-origin XHR: CORS preflight, multipart file/MIME/cache-control, real progress, waits for server confirmation and rejects HTTP failures');
} finally {
  release();
  await browser?.close();
  vite.kill();
  uploadServer.closeAllConnections();
  await new Promise(resolve => uploadServer.close(resolve));
}
