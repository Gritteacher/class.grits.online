import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const code = stripTypeScriptTypes(readFileSync('src/rewards/model.ts','utf8'));
const { validatePoints, remainingIds, winningRotation } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
test('non-repeating rounds exclude draws from this round only',()=>{
  const r={id:'r',participant_ids:['a','b','c'],allow_repeat:false};
  assert.deepEqual(remainingIds(r,[{round_id:'r',student_id:'a'},{round_id:'old',student_id:'b'}]),['b','c']);
  assert.deepEqual(remainingIds({...r,allow_repeat:true},[{round_id:'r',student_id:'a'}]),['a','b','c']);
});
test('wheel pointer lands at the chosen segment for all room sizes and repeated rotations',()=>{
  for(const count of [1,2,3,7,39,40,60,100])for(let i=0;i<count;i++)for(const current of [0,1801,9529.4]){
    const rotation=winningRotation(current,i,count);
    assert(rotation-current>=1800);
    assert(Math.abs(((rotation+(i+.5)*360/count)%360))<1e-8||Math.abs(((rotation+(i+.5)*360/count)%360)-360)<1e-8);
  }
});
test('points and reasons reject invalid values',()=>{
  for(const value of [-1,0,101,1.2,NaN,Infinity])assert.throws(()=>validatePoints(value,'reason'));
  assert.throws(()=>validatePoints(1,'   '));assert.throws(()=>validatePoints(1,'x'.repeat(501)));
  validatePoints(1,'reason');validatePoints(100,'reason');
});
