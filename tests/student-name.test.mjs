import test from 'node:test';
import assert from 'node:assert/strict';
import { studentNameMatches } from '../server/functions/_shared/student-name.js';

test('imported full and abbreviated Thai titles match without a title', () => {
  for (const title of ['', 'นาย', 'นางสาว', 'นาง', 'เด็กชาย', 'เด็กหญิง', 'น.ส.', 'น. ส. ', 'ด.ช.', 'ด.ญ.']) {
    assert.equal(studentNameMatches(`${title}สมใจ ใจดี`, 'สมใจ', 'ใจดี'), true, title);
  }
});
test('invisible import characters, whitespace and Thai sara am variants match', () => {
  assert.equal(studentNameMatches('น.\u200bส. สม\u200bใจ\u00a0 ใจดี', 'สมใจ', ' ใจดี '), true);
  assert.equal(studentNameMatches('นายกำพล ใจดี', 'ก\u0e4d\u0e32พล', 'ใจดี'), true);
  assert.equal(studentNameMatches('นายสมใจ ใจดี', 'นายสมใจ', 'ใจดี'), true);
});
test('a real name starting with title letters is not stripped unconditionally', () => {
  assert.equal(studentNameMatches('นายนายพล ใจดี', 'นายพล', 'ใจดี'), true);
});
test('wrong names, nicknames, swapped names and missing surname are rejected', () => {
  for (const [first, last] of [['สมจัย', 'ใจดี'], ['สมใจ', 'ใจดึ'], ['ใจดี', 'สมใจ'], ['สม', 'ใจดี'], ['สมใจ', '']]) {
    assert.equal(studentNameMatches('น.ส.สมใจ ใจดี', first, last), false);
  }
  assert.equal(studentNameMatches('', '', ''), false);
  assert.equal(studentNameMatches('สม-ใจ ใจดี', 'สมใจ', 'ใจดี'), false);
});
