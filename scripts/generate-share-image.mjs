import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

const server = spawn('node', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4352', '--strictPort'], {
  env: { ...process.env, VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'test' }, stdio: 'pipe',
});
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.on('data', data => { if (data.toString().includes('4352')) resolve(); });
    server.on('exit', code => reject(Error(`Vite exited ${code}`)));
  });
  browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:4352/');
  await page.setContent(`<!doctype html><html lang="th"><meta charset="UTF-8"><style>
    @font-face{font-family:Prompt;src:url('/fonts/Prompt-Regular.ttf')}
    *{box-sizing:border-box}body{margin:0;width:1200px;height:630px;background:#f5f8f7;color:#223d3b;font-family:Prompt,sans-serif;overflow:hidden}
    .top{position:absolute;top:44px;left:60px;display:flex;align-items:center;gap:20px;font-size:25px}.top img{width:70px;height:70px;object-fit:contain}
    h1{position:absolute;top:164px;left:60px;margin:0;font-size:68px;line-height:1.4;font-weight:400}h1 span{color:#116b66;font-size:90px}
    .features{position:absolute;left:64px;bottom:126px;font-size:28px;margin:0}
    .url{position:absolute;bottom:42px;left:60px;margin:0;font-size:25px;color:#116b66}
    .art{position:absolute;right:0;top:0;width:430px;height:630px;background:#e1f1ed;border-left:8px solid #ffd23f}
    canvas{position:absolute;width:188px;height:235px;border-radius:8px;box-shadow:0 8px 20px #116b6612}
    #a{left:26px;top:62px}#b{right:24px;top:188px}#c{left:26px;bottom:58px}
    .line{position:absolute;bottom:0;height:12px;width:100%;background:#2ba8a2}
  </style><div class="art"><canvas id="a"></canvas><canvas id="b"></canvas><canvas id="c"></canvas></div>
  <div class="top"><img src="/school-logo.png" alt=""><span>โรงเรียนเทพศิรินทร์ นนทบุรี</span></div>
  <h1>ห้องเรียนสังคม<br><span>ครูไต๋</span></h1><p class="features">เรียนรู้ · ส่งงาน · ติดตามผล</p><p class="url">class.gritspace.cc</p><div class="line"></div></html>`);
  await page.evaluate(async () => {
    const { renderAvatar } = await import('/src/avatar/render.ts');
    const { defaultAvatar } = await import('/src/avatar/model.ts');
    await Promise.all([
      renderAvatar(document.querySelector('#a'), { ...defaultAvatar, face: 0, skin: 2, hair: 5, outfit: 4, accessory: 0 }),
      renderAvatar(document.querySelector('#b'), { ...defaultAvatar, face: 1, skin: 4, hair: 2, outfit: 5, backdrop: 1 }),
      renderAvatar(document.querySelector('#c'), { ...defaultAvatar, face: 2, skin: 1, hair: 1, outfit: 2, backdrop: 3 }),
    ]);
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode()));
  });
  await mkdir('public/social', { recursive: true });
  await page.screenshot({ path: 'public/social/classroom-preview-v1.jpg', type: 'jpeg', quality: 90 });
  console.log('Generated 1200 x 630 sharing image');
} finally {
  await browser?.close();
  server.kill();
}
