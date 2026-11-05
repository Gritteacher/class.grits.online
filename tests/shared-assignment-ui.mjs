import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4333', '--strictPort'], {
  env: { ...process.env, VITE_SUPABASE_URL: 'https://example.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test' }, stdio: 'pipe',
});
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (data) => { if (data.toString().includes('4333')) resolve(); });
    server.on('exit', (code) => reject(Error(`Vite exited ${code}`)));
  });
  browser = await chromium.launch({ channel: 'chrome' });
  for (const width of [1440, 390]) for (const initialRoomCount of [2, 8]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const id = '00000000-0000-4000-8000-000000000001';
    const expires = Math.floor(Date.now() / 1000) + 3600;
    const jwt = [{ alg: 'HS256', typ: 'JWT' }, { sub: id, exp: expires, role: 'authenticated' }]
      .map((item) => Buffer.from(JSON.stringify(item)).toString('base64url')).join('.') + '.test';
    await page.addInitScript((session) => localStorage.setItem('sb-example-auth-token', JSON.stringify(session)), {
      access_token: jwt, refresh_token: 'test', expires_at: expires, expires_in: 3600, token_type: 'bearer', user: { id, aud: 'authenticated', role: 'authenticated' },
    });
    const classrooms = Array.from({ length: 8 }, (_, index) => ({ id: `room${index + 1}`, name: `ม.6/${index + 1}`, room: String(index + 1), subject: 'สังคมศึกษา', teacher_id: id, level: 'ม.6', academic_year: '2569' }));
    let assignment = { id: 'work1', title: '3', description: 'ใบงานหน้าที่ 3 เขียนด้วยลายมือเท่านั้น', category: 'ใบงาน', raw_max: 10, final_max: 10,
      due_at: '2026-12-01T16:59:00Z', closes_at: '2026-12-01T16:59:00Z', opens_at: null, submission_required: true, submission_mode: 'individual', group_size: 1 };
    let links = classrooms.slice(0, initialRoomCount).map((room) => ({ assignment_id: 'work1', classroom_id: room.id }));
    let writes = 0;
    await page.route('https://example.supabase.co/**', async (route) => {
      const req = route.request(); const url = new URL(req.url()); let body = [];
      if (url.pathname.endsWith('/profiles')) body = { id, role: 'teacher', display_name: 'ครูทดสอบ', student_code: null, recovery_email: 'test@example.test' };
      if (url.pathname.endsWith('/classrooms')) body = classrooms;
      if (url.pathname.endsWith('/assignments')) {
        if (req.method() === 'PATCH') { assignment = { ...assignment, ...req.postDataJSON() }; writes++; body = { id: 'work1' }; }
        else body = [assignment];
      }
      if (url.pathname.endsWith('/assignment_classrooms')) {
        assert.notEqual(req.method(), 'DELETE', 'Existing room links must never be removed');
        if (req.method() === 'POST') links.push(...req.postDataJSON());
        body = links;
      }
      await route.fulfill({ json: body });
    });
    await page.goto('http://127.0.0.1:4333/');
    await page.getByRole('button', { name: 'พื้นที่งาน', exact: true }).click();
    await page.getByRole('button', { name: 'แก้ไขงาน', exact: true }).click();
    const dialog = page.getByRole('dialog');
    const checkboxes = dialog.locator('.room-checkboxes input');
    await expect(checkboxes).toHaveCount(8);
    for (let index = 0; index < 8; index++) await expect(checkboxes.nth(index)).toBeChecked({ checked: index < initialRoomCount });
    await expect(dialog.getByRole('region', { name: 'ห้องที่ได้รับผลกระทบ' })).toContainText(`เปลี่ยน ${initialRoomCount} ห้อง · คงเดิม 0 ห้อง`);
    await checkboxes.nth(1).uncheck();
    for (const box of await checkboxes.all()) await expect(box).not.toBeChecked();
    await checkboxes.nth(7).check();
    if (initialRoomCount === 8) await dialog.getByLabel('ชื่องาน', { exact: true }).fill('3 แก้ไขแล้ว');
    await page.screenshot({ path: `/tmp/shared-assignment-${width}.png`, fullPage: true });
    await dialog.getByRole('button', { name: /บันทึกการแก้ไข|บันทึกงาน|มอบหมายงาน|บันทึก/ }).last().click();
    try { await expect(dialog).toHaveCount(0); }
    catch (error) {
      console.log(await dialog.innerText());
      console.log(await dialog.locator('input:invalid,select:invalid,textarea:invalid').evaluateAll((items) => items.map((item) => ({ name: item.name, value: item.value, error: item.validationMessage }))));
      throw error;
    }
    await expect.poll(() => writes).toBe(1);
    const expectedRooms = initialRoomCount === 8 ? classrooms : [classrooms[0], classrooms[1], classrooms[7]];
    await expect.poll(() => links.length).toBe(expectedRooms.length);
    assert.deepEqual(links.map((link) => link.classroom_id).sort(), expectedRooms.map((room) => room.id).sort());
    assert.equal(assignment.title, initialRoomCount === 8 ? '3 แก้ไขแล้ว' : '3');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.close();
  }
  console.log('Passed desktop/mobile: all 8 linked rooms visible and editable, accurate summary, saved title and all room links preserved.');
} finally {
  await browser?.close(); server.kill('SIGTERM');
  await new Promise((resolve) => { if (server.exitCode !== null) resolve(); else server.once('exit', resolve); });
}
