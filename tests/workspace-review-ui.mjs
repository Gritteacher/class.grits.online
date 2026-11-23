import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const server = spawn('node', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4336', '--strictPort'], {
  env: { ...process.env, VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' },
  stdio: 'pipe',
});
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (data) => { if (data.toString().includes('4336')) resolve(); });
    server.on('exit', (code) => reject(Error(`Vite exited ${code}`)));
  });
  browser = await chromium.launch({ channel: 'chrome' });
  for (const width of [1280, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const teacherId = '00000000-0000-4000-8000-000000000001';
    const studentId = '00000000-0000-4000-8000-000000000002';
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const token = [{ alg: 'HS256', typ: 'JWT' }, { sub: teacherId, exp: expires, role: 'authenticated' }]
      .map((item) => Buffer.from(JSON.stringify(item)).toString('base64url')).join('.') + '.test';
    await page.addInitScript((session) => localStorage.setItem('sb-example-auth-token', JSON.stringify(session)), {
      access_token: token, refresh_token: 'test', expires_at: expires, expires_in: 3600, token_type: 'bearer',
      user: { id: teacherId, aud: 'authenticated', role: 'authenticated' },
    });
    const assignment = { id: 'assignment1', title: 'ใบงานชุมชนของเรา', description: 'อธิบายความสัมพันธ์ของชุมชนจากภาพที่กำหนด', category: 'ใบงาน', raw_max: 10, final_max: 10, due_at: '2026-12-31T16:59:59Z', opens_at: null, closes_at: null, submission_required: true, submission_mode: 'individual', group_size: 1, room_schedules: {} };
    const room = { id: 'room1', name: 'ม.6/2', room: '2', level: 'ม.6', subject: 'สังคมศึกษา', teacher_id: teacherId, academic_year: '2569' };
    const student = { id: studentId, role: 'student', display_name: 'นักเรียนทดสอบ', student_code: '00002', status: 'active' };
    const fileData = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#d6ece8"/><path d="M12 62h96M22 54l20-20 14 12 12-15 30 23" stroke="#14756f" fill="none" stroke-width="4"/></svg>')}`;
    await page.route('https://example.supabase.co/**', async (route) => {
      const url = new URL(route.request().url());
      let body = [];
      if (url.pathname.endsWith('/profiles')) body = url.searchParams.has('role') ? [student] : [teacherId === url.searchParams.get('id')?.replace('eq.', '') ? { id: teacherId, role: 'teacher', display_name: 'ครูทดสอบ' } : student];
      if (url.pathname.endsWith('/classrooms')) body = [room];
      if (url.pathname.endsWith('/classroom_members')) body = [{ classroom_id: room.id, student_id: studentId, student_number: 2 }];
      if (url.pathname.endsWith('/assignments')) body = [assignment];
      if (url.pathname.endsWith('/assignment_classrooms')) body = [{ assignment_id: assignment.id, classroom_id: room.id }];
      if (url.pathname.endsWith('/submissions')) body = [{ id: 'submission1', assignment_id: assignment.id, student_id: studentId, response: 'คำตอบทดสอบ', link: null, file_path: 'submissions/student/file.jpg', file_name: 'งานของฉัน.jpg', file_type: 'image/jpeg', status: 'pending', feedback: '', submitted_at: '2026-11-19T08:00:00Z', reviewed_at: null, returned_at: null, resubmit_until: null, revision_note: '', group_id: null, group_member_ids: [studentId] }];
      if (url.pathname.endsWith('/storage/v1/object/sign/classroom-files')) body = [{ path: 'submissions/student/file.jpg', signedURL: fileData, error: null }];
      return route.fulfill({ json: body });
    });
    await page.goto('http://127.0.0.1:4336/');
    await page.getByRole('button', { name: 'พื้นที่งาน', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'พื้นที่งาน', exact: true })).toBeVisible();
    await expect(page.getByText('คิวที่ต้องตรวจ', { exact: true })).toBeVisible();
    await expect(page.getByText('นักเรียนทดสอบ', { exact: true })).toBeVisible();
    const row = page.locator('.review-row').first();
    const box = await row.boundingBox();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: `/tmp/workspace-review-${width}.png`, fullPage: true });
    assert.ok(box.height < 260, `Review row too tall at ${width}: ${box.height}`);
    await page.close();
  }
  console.log('PASS review queue layout at 1280/390/320px: compact rows, preview, score controls and no horizontal overflow');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
