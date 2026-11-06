import test from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../server/functions/student-account-status.js';

test('teacher sees only owned students, real signup/login dates and explicit unknown on Auth failure', async () => {
  const oldFetch = globalThis.fetch;
  const oldUrl = process.env.VITE_SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  const room = '11111111-1111-4111-8111-111111111111';
  const teacher = '22222222-2222-4222-8222-222222222222';
  const ids = [3, 4, 5].map(n => `${n}${'0'.repeat(7)}-1111-4111-8111-111111111111`);
  let role = 'teacher', owned = true, failAuth = false, incomplete = false;
  let authReads = 0;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    assert.equal(request.method, 'GET');
    const reply = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (url.pathname === '/auth/v1/user') return reply({ id: teacher });
    if (url.pathname.includes('/auth/v1/admin/users/')) {
      authReads++;
      const id = url.pathname.split('/').at(-1);
      assert.ok(ids.includes(id), 'must not enumerate other users');
      if (failAuth && id === ids[2]) return reply({ message: 'Unavailable' }, 503);
      return reply({ id, last_sign_in_at: id === ids[0] ? '2026-11-06T02:00:00Z' : null });
    }
    if (url.pathname.endsWith('/classrooms')) {
      assert.equal(url.searchParams.get('teacher_id'), `eq.${teacher}`);
      assert.equal(url.searchParams.get('id'), `eq.${room}`);
      return reply(owned ? { id: room } : null);
    }
    if (url.pathname.endsWith('/classroom_members')) {
      assert.equal(url.searchParams.get('classroom_id'), `eq.${room}`);
      return reply(ids.map(student_id => ({ student_id })));
    }
    assert.equal(url.pathname, '/rest/v1/profiles');
    if (url.searchParams.has('id') && url.searchParams.get('id') === `eq.${teacher}`) return reply({ role });
    return reply((incomplete ? ids.slice(0, 1) : ids).map((id, i) => ({ id, student_claimed_at: i === 0 ? '2026-11-05T02:00:00Z' : null })));
  };
  const event = { httpMethod: 'POST', headers: { authorization: 'Bearer test' }, body: JSON.stringify({ classroomId: room }) };
  try {
    assert.equal((await handler({ ...event, headers: {} })).statusCode, 401);
    const success = await handler(event);
    assert.equal(success.statusCode, 200);
    const students = JSON.parse(success.body).students;
    assert.equal(students.length, 3);
    assert.equal(students[0].registeredAt, '2026-11-05T02:00:00Z');
    assert.equal(students[0].lastSignInAt, '2026-11-06T02:00:00Z');
    assert.equal(students[1].registeredAt, null);
    assert.equal(students[1].lastSignInAt, null);
    assert.equal(students[1].loginStatusKnown, true);
    assert.deepEqual(Object.keys(students[0]).sort(), ['id', 'lastSignInAt', 'loginStatusKnown', 'registeredAt']);
    failAuth = true;
    const partial = JSON.parse((await handler(event)).body).students;
    assert.equal(partial[2].loginStatusKnown, false);
    const reads = authReads;
    owned = false;
    assert.equal((await handler(event)).statusCode, 403);
    assert.equal(authReads, reads);
    owned = true; role = 'student';
    assert.equal((await handler(event)).statusCode, 403);
    assert.equal(authReads, reads);
    role = 'teacher'; incomplete = true;
    assert.equal((await handler(event)).statusCode, 500);
    assert.equal(authReads, reads);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.VITE_SUPABASE_URL; else process.env.VITE_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = oldKey;
  }
});
