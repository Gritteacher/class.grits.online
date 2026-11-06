import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const source = stripTypeScriptTypes(readFileSync(new URL('../src/attendance/model.ts', import.meta.url), 'utf8'));
const { validDate, validateLeave, approvedLeaveOn } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
test('validates real dates and leave duration/reason', () => {
  assert.equal(validDate('2024-02-29'), true);
  for (const day of ['2026-02-29','2026-13-01','bad','2026-2-1']) assert.equal(validDate(day), false);
  assert.doesNotThrow(() => validateLeave('2026-11-01','2026-12-01','ลากิจ'));
  for (const args of [['2026-11-02','2026-11-01','ลากิจ'],['2026-11-01','2026-12-02','ลากิจ'],['2026-11-01','2026-11-01',' '],['2026-11-01','2026-11-01','x'.repeat(1001)]]) assert.throws(() => validateLeave(...args));
});
test('only approved leave for the same student and inclusive date qualifies', () => {
  const leaves=[{student_id:'a',status:'approved',starts_on:'2026-11-01',ends_on:'2026-11-03'}, {student_id:'b',status:'pending',starts_on:'2026-11-01',ends_on:'2026-11-03'}];
  assert.equal(approvedLeaveOn(leaves,'a','2026-11-01'),true);
  assert.equal(approvedLeaveOn(leaves,'a','2026-11-03'),true);
  assert.equal(approvedLeaveOn(leaves,'a','2026-11-04'),false);
  assert.equal(approvedLeaveOn(leaves,'b','2026-11-01'),false);
});
