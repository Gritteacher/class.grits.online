import test from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../server/functions/claim-student-account.js';

test('signup endpoint accepts imported abbreviated names and rejects incorrect names before writes', async () => {
  const previousFetch = globalThis.fetch;
  const oldUrl = process.env.VITE_SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const oldResend = process.env.RESEND_API_KEY;
  const oldError = console.error;
  let writes = 0;
  let claimed = false;
  process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only';
  delete process.env.RESEND_API_KEY;
  console.error = () => {};
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const reply = body => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
    if (request.method === 'PUT' && url.pathname === '/auth/v1/admin/users/11111111-1111-4111-8111-111111111111') {
      writes++;
      return reply({ id: '11111111-1111-4111-8111-111111111111' });
    }
    assert.equal(url.pathname, '/rest/v1/profiles');
    if (request.method === 'PATCH') {
      writes++;
      return reply({ id: '11111111-1111-4111-8111-111111111111' });
    }
    if (url.searchParams.has('recovery_email')) return reply(null);
    return reply({ id: '11111111-1111-4111-8111-111111111111', role: 'student', status: 'active', display_name: 'น.ส.สมใจ ใจดี',
      recovery_email: null, student_claimed_at: claimed ? '2026-11-05' : null });
  };
  const submit = (firstName, lastName) => handler({ httpMethod: 'POST', body: JSON.stringify({
    studentCode: '12345', firstName, lastName, email: 'student@example.com', password: 'test-only-password',
  }) });
  try {
    const wrong = await submit('สมจัย', 'ใจดี');
    assert.equal(wrong.statusCode, 400);
    assert.equal(JSON.parse(wrong.body).field, 'name');
    assert.equal(writes, 0);
    assert.equal((await submit('สมใจ', 'ใจดี')).statusCode, 200);
    assert.equal(writes, 2);
    claimed = true;
    const duplicate = await submit('สมใจ', 'ใจดี');
    assert.equal(duplicate.statusCode, 400);
    assert.match(JSON.parse(duplicate.body).error, /สมัครใช้งานแล้ว/);
    assert.equal(writes, 2);
  } finally {
    globalThis.fetch = previousFetch;
    console.error = oldError;
    for (const [key, value] of Object.entries({ VITE_SUPABASE_URL: oldUrl, SUPABASE_SERVICE_ROLE_KEY: oldKey, RESEND_API_KEY: oldResend })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
