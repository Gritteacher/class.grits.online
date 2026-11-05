import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import { SourceTextModule } from 'node:vm';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';
const cache = new Map();
async function load(path) {
  if (!cache.has(path)) cache.set(path, new SourceTextModule(stripTypeScriptTypes(await readFile(path, 'utf8')), { identifier: path }));
  return cache.get(path);
}
const module = await load(resolve('src/work/model.ts'));
await module.link((specifier, parent) => load(resolve(dirname(parent.identifier), specifier + '.ts')));
await module.evaluate();
const { saveAssignmentGroup } = module.namespace;
const shared = { id: 'work1', groupId: 'work1', revision: 0, title: 'งานเดิม', description: 'โจทย์เดิม',
  rooms: ['ม.6/1', 'ม.6/2', 'ม.6/3'], category: 'ใบงาน', rawMax: 10, finalMax: 10,
  due: '2026-12-01', closesAt: '2026-12-01T16:59:00Z', color: 'teal' };
const unrelated = { ...shared, id: 'work2', groupId: 'work2', rooms: ['ม.6/4'] };
const state = { version: 1, rooms: [...shared.rooms, 'ม.6/4'], assignments: [shared, unrelated],
  students: [{ id: 's1', room: 'ม.6/2' }], submissions: [],
  grades: [{ id: 'g1', studentId: 's1', assignmentId: 'work1', raw: 8, source: 'manual', revision: 1 }], gradeEvents: [] };
const saved = saveAssignmentGroup(state, { ...shared, title: 'แก้ไขแล้ว' }, false, { work1: 0 });
assert.deepEqual(saved.assignments[0].rooms, shared.rooms);
assert.equal(saved.assignments[0].id, 'work1');
assert.equal(saved.assignments[0].title, 'แก้ไขแล้ว');
assert.equal(saved.assignments[1], unrelated);
assert.deepEqual(saved.grades, state.grades);
const expanded = saveAssignmentGroup(state, { ...shared, rooms: [...shared.rooms, 'ม.6/4'] }, false, { work1: 0 });
assert.deepEqual(expanded.assignments[0].rooms, [...shared.rooms, 'ม.6/4']);
assert.equal(expanded.assignments[0].id, shared.id);
assert.deepEqual(expanded.grades, state.grades);
assert.equal(expanded.assignments[1], unrelated);
assert.throws(() => saveAssignmentGroup(state, { ...shared, rooms: ['ม.6/2'], title: 'แก้ไขแล้ว' }, false, { work1: 0 }), /เลือกให้ครบ/);
assert.throws(() => saveAssignmentGroup(state, { ...shared, rawMax: 5 }, true, { work1: 0 }), /ต่ำกว่าคะแนน/);
const split = { ...state, assignments: [
  { ...shared, id: 'a1', groupId: 'group', rooms: ['ม.6/1'] },
  { ...shared, id: 'a2', groupId: 'group', rooms: ['ม.6/2'] },
], grades: [] };
const edited = saveAssignmentGroup(split, { ...split.assignments[0], title: 'แก้เฉพาะห้องสอง', rooms: ['ม.6/2'] }, false, { a1: 0, a2: 0 });
assert.equal(edited.assignments[0].title, 'งานเดิม');
assert.equal(edited.assignments[1].title, 'แก้เฉพาะห้องสอง');
console.log('Passed multi-room editing: all room links and IDs preserved, grades retained, partial shared edits rejected, independent room edits supported.');
