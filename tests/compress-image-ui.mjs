import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const server = spawn('node', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4339', '--strictPort'], { stdio: 'pipe' });
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.on('data', data => { if (data.toString().includes('4339')) resolve(); });
    server.on('exit', code => reject(Error(`Vite exited ${code}`)));
  });
  browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4339/tests/material-actions-fixture.html');
  const result = await page.evaluate(async () => {
    const { compressImage } = await import('/src/lib/compressImage.ts');
    const canvas = document.createElement('canvas');
    canvas.width = 4000; canvas.height = 3000;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 4000, 3000);
    ctx.fillStyle = 'black'; ctx.font = '90px sans-serif';
    for (let y = 150; y < 3000; y += 150) ctx.fillText('Assignment 123456789 - readable text', 100, y);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 1));
    const file = new File([blob], 'assignment.jpg', { type: 'image/jpeg', lastModified: 1234 });
    const compressed = await compressImage(file);
    const bitmap = await createImageBitmap(compressed);
    const pdf = new File(['pdf'], 'lesson.pdf', { type: 'application/pdf' });
    const gif = new File(['gif'], 'animation.gif', { type: 'image/gif' });
    canvas.width = 4000; canvas.height = 1;
    const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const png = await compressImage(new File([pngBlob], 'transparent.png', { type: 'image/png' }));
    const pngBitmap = await createImageBitmap(png);
    const check = document.createElement('canvas');
    check.width = pngBitmap.width; check.height = pngBitmap.height;
    const checkCtx = check.getContext('2d'); checkCtx.drawImage(pngBitmap, 0, 0);
    let rejected = false;
    try { await compressImage(new File(['not an image'], 'broken.jpg', { type: 'image/jpeg' })); } catch { rejected = true; }
    return { before: file.size, after: compressed.size, width: bitmap.width, height: bitmap.height,
      name: compressed.name, type: compressed.type, modified: compressed.lastModified,
      pdfUnchanged: await compressImage(pdf) === pdf, gifUnchanged: await compressImage(gif) === gif,
      alpha: checkCtx.getImageData(0, 0, 1, 1).data[3], rejected };
  });
  assert.ok(result.after < result.before);
  assert.ok(result.width <= 2560 && result.height <= 2560);
  assert.equal(result.name, 'assignment.jpg');
  assert.equal(result.type, 'image/jpeg');
  assert.equal(result.modified, 1234);
  assert.ok(result.pdfUnchanged && result.gifUnchanged && result.rejected);
  assert.equal(result.alpha, 0);
  console.log('Image compression browser tests passed:', result);
} finally {
  await browser?.close();
  server.kill();
}
