import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const code=stripTypeScriptTypes(readFileSync('src/services/submissionError.ts','utf8'));
const {submissionError}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
test('submission errors distinguish storage size, expired session, policy, quota and network',()=>{
  for(const [input,text] of [[{statusCode:'413'},'2 MB'],[{status:401},'หมดอายุ'],[{code:'42501'},'ไม่มีสิทธิ์'],[{message:'Storage quota exceeded'},'ระบบเต็ม'],[{message:'Failed to fetch'},'การเชื่อมต่อขัดข้อง']])assert.match(submissionError('upload',input).message,new RegExp(text));
  assert.match(submissionError('save',{code:'23503'}).message,/บันทึกงาน.*23503/);
  assert.doesNotMatch(submissionError('save',{message:'sensitive database details'}).message,/sensitive/);
});
