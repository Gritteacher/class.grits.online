import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { SourceTextModule, SyntheticModule } from 'node:vm';
import { resolve, dirname } from 'node:path';

const events = [];
let failure = '';
const profile = { id: 's1', role: 'student', display_name: 'Test', student_code: '001', status: 'active' };
const rows = {
  assignments: [{ id: 'a1', title: 'Test', description: '', category: 'ใบงาน', raw_max: 10, final_max: 10, submission_required: true, submission_mode: 'individual', group_size: 1 }],
  assignment_classrooms: [{ assignment_id: 'a1', classroom_id: 'r1' }],
  classrooms: [{ id: 'r1', name: 'ม.6/1', room: '1' }],
  classroom_members: [{ classroom_id: 'r1', student_id: 's1', student_number: 1 }],
  submissions: ['one', 'one', 'denied'].map((path, i) => ({ id: `sub${i}`, assignment_id: 'a1', student_id: 's1', file_path: path, file_name: path, status: 'pending', group_member_ids: [] })),
  score_entries: [],
};
const supabase = {
  from(table) {
    const filters = [];
    let single = false;
    return {
      select() { return this; }, order() { return this; },
      in(...args) { filters.push(args); return this; },
      eq(...args) { filters.push(args); return this; },
      maybeSingle() { single = true; return this; },
      async then(done, reject) {
        events.push({ table, phase: 'start', filters });
        await new Promise(r => setTimeout(r, 15));
        events.push({ table, phase: 'end' });
        let data = table === 'profiles' ? profile : rows[table] ?? [];
        if (single && Array.isArray(data)) data = data[0];
        return Promise.resolve({ data, error: failure === table ? { code: 'denied' } : null }).then(done, reject);
      },
    };
  },
  storage: { from() { return { async createSignedUrls(paths, expiry) {
    events.push({ table: 'sign', paths, expiry });
    return { data: paths.map(path => path === 'denied' ? { path, error: 'denied' } : { path, signedUrl: `https://files.test/${path}` }) };
  } }; } },
};
const dependency = new SyntheticModule(['supabase'], function () { this.setExport('supabase', supabase); });
const cache = new Map();
async function load(path) {
  if (path.endsWith('/lib/supabase.ts')) return dependency;
  if (!cache.has(path)) cache.set(path, new SourceTextModule(stripTypeScriptTypes(readFileSync(path, 'utf8')), { identifier: path }));
  return cache.get(path);
}
async function service(name) {
  const module = await load(resolve(`src/services/${name}.ts`));
  await module.link((specifier, parent) => load(resolve(dirname(parent.identifier), `${specifier}.ts`)));
  await module.evaluate();
  return module.namespace;
}
function parallel(first, second) {
  assert(events.findIndex(e => e.table === second && e.phase === 'start') < events.findIndex(e => e.table === first && e.phase === 'end'));
}
const work = await service('workService');
const result = await work.loadWork('s1', 'student');
parallel('assignment_classrooms', 'submissions');
parallel('assignment_classrooms', 'score_entries');
assert.equal(events.filter(e => e.table === 'sign').length, 1);
assert.deepEqual(events.find(e => e.table === 'sign').paths, ['one', 'denied']);
assert.equal(result.submissions[0].file.data, 'https://files.test/one');
assert.equal(result.submissions[2].file.data, 'denied');
for (const table of ['submissions', 'score_entries']) assert(events.find(e => e.table === table && e.phase === 'start').filters.some(f => f[0] === 'student_id' && f[1] === 's1'));
failure = 'score_entries';
await assert.rejects(work.loadWork('s1', 'student'), /โหลดคะแนน/);
failure = '';
events.length = 0;
const classroom = await service('classroomService');
assert.equal((await classroom.loadStudentProfile('s1')).room, 'ม.6/1');
parallel('classroom_members', 'profiles');
events.length = 0;
const auth = await service('authService');
const session = { user: { id: 's1' } };
const identities = await Promise.all([auth.getCurrentIdentity(session), auth.getCurrentIdentity(session)]);
assert.equal(events.filter(e => e.table === 'profiles' && e.phase === 'start').length, 1);
assert.equal(identities[0].profile.id, 's1');
await auth.getCurrentIdentity(session);
assert.equal(events.filter(e => e.table === 'profiles' && e.phase === 'start').length, 2, 'Completed reads must not become a stale profile cache');
console.log('PASS: parallel work/profile reads, one batch signing request, student filters, error handling and in-flight-only identity deduplication');
