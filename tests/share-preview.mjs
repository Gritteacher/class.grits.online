import { chromium, expect } from '@playwright/test';
import { readFileSync, statSync } from 'node:fs';
import assert from 'node:assert/strict';

const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ javaScriptEnabled: false });
  await page.setContent(readFileSync('index.html', 'utf8'));
  const expected = {
    'og:type': 'website',
    'og:title': 'ห้องเรียนสังคมครูไต๋',
    'og:url': 'https://class.gritspace.cc/',
    'og:image': 'https://class.gritspace.cc/social/classroom-preview-v1.jpg',
    'og:image:width': '1200',
    'og:image:height': '630',
  };
  for (const [property, content] of Object.entries(expected)) {
    await expect(page.locator(`head meta[property="${property}"]`)).toHaveCount(1);
    await expect(page.locator(`head meta[property="${property}"]`)).toHaveAttribute('content', content);
  }
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
  const file = 'public/social/classroom-preview-v1.jpg';
  assert(statSync(file).size < 300_000, 'Preview should remain lightweight');
  const image = readFileSync(file).toString('base64');
  const dimensions = await page.evaluate(async data => {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${data}`;
    await img.decode();
    return [img.naturalWidth, img.naturalHeight];
  }, image);
  assert.deepEqual(dimensions, [1200, 630]);
  console.log('PASS: static sharing metadata without app JavaScript, correct image dimensions and file size');
} finally {
  await browser.close();
}
