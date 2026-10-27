import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorker } from '../worker/index.js';

const assets = { ASSETS: { fetch: async () => new Response('app shell') } };
test('forwards authorization and request body to server functions', async () => {
  let seen;
  const worker = createWorker({ example: async event => {
    seen = event;
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: '{"ok":true}' };
  }});
  const response = await worker.fetch(new Request('https://class.gritspace.cc/api/example', {
    method: 'POST', headers: { Authorization: 'Bearer test', Origin: 'https://class.gritspace.cc' }, body: '{"id":1}',
  }), assets);
  assert.equal(response.status, 200);
  assert.equal(seen.headers.authorization, 'Bearer test');
  assert.equal(seen.body, '{"id":1}');
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('unknown and removed endpoints do not fall through to the SPA', async () => {
  const worker = createWorker({});
  for (const path of ['/api/line-account', '/api/cleanup-submission-files', '/api/missing']) {
    assert.equal((await worker.fetch(new Request('https://class.gritspace.cc'+path), assets)).status, 404);
  }
});
test('preflight 204 responses have no body and foreign origins are rejected', async () => {
  const worker = createWorker({ example: async () => ({ statusCode: 204, body: '{}' }) });
  const response = await worker.fetch(new Request('https://class.gritspace.cc/api/example', { method: 'OPTIONS' }), assets);
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.equal((await worker.fetch(new Request('https://class.gritspace.cc/api/example', { headers: { Origin: 'https://other.example' } }), assets)).status, 403);
});
test('legacy URLs work, assets are served, and cleanup is scheduled only', async () => {
  let cleaned = false; let job;
  const worker = createWorker({ example: async () => ({ statusCode: 200, body: 'ok' }) }, async () => {
    cleaned = true; return { statusCode: 200 };
  });
  assert.equal(await (await worker.fetch(new Request('https://class.gritspace.cc/.netlify/functions/example'), assets)).text(), 'ok');
  assert.equal(await (await worker.fetch(new Request('https://class.gritspace.cc/room/1'), assets)).text(), 'app shell');
  await worker.scheduled({}, {}, { waitUntil(promise) { job = promise; } });
  await job; assert.equal(cleaned, true);
});
