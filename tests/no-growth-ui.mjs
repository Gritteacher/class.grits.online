import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4330', '--strictPort'], {
  env: { ...process.env, VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }, stdio: 'pipe',
});
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (data) => { if (data.toString().includes('4330')) resolve(); });
    server.on('exit', (code) => reject(Error(`Vite exited ${code}`)));
  });
  browser = await chromium.launch({ channel: 'chrome' });
  for (const width of [1280, 390]) for (const role of ['teacher', 'student']) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const id = role === 'teacher' ? '00000000-0000-4000-8000-000000000001' : '00000000-0000-4000-8000-000000000002';
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const token = [{ alg: 'HS256', typ: 'JWT' }, { sub: id, exp: expires, role: 'authenticated' }]
      .map((item) => Buffer.from(JSON.stringify(item)).toString('base64url')).join('.') + '.test';
    await page.addInitScript((session) => localStorage.setItem('sb-example-auth-token', JSON.stringify(session)), {
      access_token: token, refresh_token: 'test', expires_at: expires, expires_in: 3600, token_type: 'bearer',
      user: { id, aud: 'authenticated', role: 'authenticated' },
    });
    const requests = [];
    const student = { id: '00000000-0000-4000-8000-000000000002', role: 'student', display_name: 'นักเรียนทดสอบ', student_code: '00001', recovery_email: 'test@example.test', status: 'active' };
    const classroom = { id: 'room1', name: 'ม.6/1', room: '1', level: 'ม.6', subject: 'สังคมศึกษา', teacher_id: '00000000-0000-4000-8000-000000000001', academic_year: '2569' };
    await page.route('https://example.supabase.co/**', async (route) => {
      const url = new URL(route.request().url());
      requests.push(url.pathname);
      let body = [];
      if (url.pathname.endsWith('/profiles')) body = url.searchParams.has('role') ? [student] : role === 'student' ? student : {
        id, role, display_name: 'ครูทดสอบ', student_code: null, recovery_email: 'teacher@example.test',
      };
      if (url.pathname.endsWith('/classrooms')) body = url.searchParams.get('id')?.startsWith('eq.') ? classroom : [classroom];
      if (url.pathname.endsWith('/classroom_members')) body = [{ classroom_id: 'room1', student_id: student.id, student_number: 1 }];
      if (url.pathname.endsWith('/student_avatar_customizations')) body = null;
      await route.fulfill({ json: body });
    });
    await page.goto('http://127.0.0.1:4330/');
    await expect(page.getByRole('navigation', { name: 'เมนูหลัก' })).toBeVisible();
    if (role === 'teacher') {
      await page.getByRole('button', { name: 'เมนูเพิ่มเติม', exact: true }).click();
      await expect(page.getByRole('menuitem', { name: 'รายงาน', exact: true })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'ห้องเรียน', exact: true })).toBeVisible();
      await page.getByRole('menuitem', { name: 'ห้องเรียน', exact: true }).click();
      await expect(page.getByText('นักเรียนทดสอบ', { exact: true })).toBeVisible();
    } else {
      await expect(page.getByRole('button', { name: 'เมนูเพิ่มเติม', exact: true })).toHaveCount(1);
      await expect(page.locator('.main-nav button')).toHaveCount(5);
    }
    await page.getByRole('button', { name: 'เมนูเพิ่มเติม', exact: true }).click();
    await page.getByRole('menuitem', { name: 'เช็คชื่อและการลา', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'เช็คชื่อและการลา', exact: true })).toBeVisible();
    if(role==='student'){
      await page.getByRole('button',{name:'เมนูเพิ่มเติม',exact:true}).click();
      await page.getByRole('menuitem',{name:'อวตาร์ของฉัน',exact:true}).click();
      await expect(page.getByRole('heading',{name:'อวตาร์ของฉัน',exact:true})).toBeVisible();
      await expect(page.getByRole('button',{name:'แต่งอวตาร์',exact:true})).toBeEnabled();
    }
    await expect(page.getByText('การเติบโต', { exact: true })).toHaveCount(0);
    await expect(page.locator('.growth-page')).toHaveCount(0);
    await page.waitForLoadState('networkidle');
    assert.deepEqual(requests.filter((url) => /growth|student_avatars(?:\?|$)|observation|reinforcement/.test(url)), []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `/tmp/no-growth-${role}-${width}.png`, fullPage: true });
    await page.close();
  }
  console.log('Passed teacher/student desktop/mobile: growth removed, attendance accessible to both roles, teacher reports/roster retained.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  await new Promise((resolve) => { if (server.exitCode !== null) resolve(); else server.once('exit', resolve); });
}
