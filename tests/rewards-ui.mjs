import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const server = spawn('node', ['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4356','--strictPort'], {
  env:{...process.env,VITE_SUPABASE_URL:'https://example.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'test'},stdio:'pipe',
});
let browser;
const room='30000000-0000-4000-8000-000000000001',otherRoom='30000000-0000-4000-8000-000000000002';
const student=i=>`20000000-0000-4000-8000-${String(i).padStart(12,'0')}`;
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
try{
  await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(d.toString().includes('4356'))resolve();});server.on('exit',reject);});
  browser=await chromium.launch({channel:'chrome'});
  for(const width of [1280,390,320]){
    const context=await browser.newContext({viewport:{width,height:1000}});
    const page=await context.newPage();
    const rounds=[],draws=[],entries=[];let loseAward=true,loseSpin=false,spinCalls=0;
    let currentStudent=student(1);
    await context.route('https://example.supabase.co/**',async route=>{
      const request=route.request(),url=new URL(request.url()),name=url.pathname.split('/').at(-1);
      const respond=(value,status=200)=>route.fulfill({status,json:value});
      const params=request.method()==='POST'?request.postDataJSON():{};
      const now=()=>new Date().toISOString();
      if(url.pathname.includes('/rpc/')){
        if(name==='start_classroom_wheel_round'){
          const existing=rounds.find(r=>r.id===params.p_id);if(existing)return respond(existing);
          rounds.filter(r=>r.classroom_id===params.p_classroom&&!r.closed_at).forEach(r=>r.closed_at=now());
          const r={id:params.p_id,classroom_id:params.p_classroom,teacher_id:'teacher',participant_ids:params.p_students,allow_repeat:params.p_repeat,attendance_date:params.p_date,attendance_period:params.p_period,created_at:now(),closed_at:null};rounds.push(r);return respond(r);
        }
        if(name==='spin_classroom_wheel'){
          spinCalls++;const existing=draws.find(d=>d.id===params.p_id);if(existing)return respond(existing);
          const r=rounds.find(r=>r.id===params.p_round);const ids=r.participant_ids.filter(id=>r.allow_repeat||!draws.some(d=>d.round_id===r.id&&d.student_id===id));
          const d={id:params.p_id,round_id:r.id,classroom_id:r.classroom_id,teacher_id:'teacher',student_id:ids[0],created_at:now()};draws.unshift(d);
          if(loseSpin){loseSpin=false;return respond({code:'NETWORK',message:'Lost response'},500);}return respond(d);
        }
        if(name==='award_classroom_reinforcement'){
          let entry=entries.find(e=>e.draw_id===params.p_draw);
          if(!entry){const d=draws.find(d=>d.id===params.p_draw);entry={id:params.p_id,draw_id:d.id,student_id:d.student_id,classroom_id:d.classroom_id,teacher_id:'teacher',teacher_name:'ครูทดสอบ',points:params.p_points,reason:params.p_reason,reverses_id:null,created_at:now()};entries.unshift(entry);}
          if(loseAward){loseAward=false;return respond({code:'NETWORK',message:'Lost response'},500);}return respond(entry);
        }
        if(name==='reverse_classroom_reinforcement'){
          let entry=entries.find(e=>e.reverses_id===params.p_entry);
          if(!entry){const original=entries.find(e=>e.id===params.p_entry);entry={...original,id:crypto.randomUUID(),draw_id:null,reverses_id:original.id,points:-original.points,reason:params.p_reason,created_at:now()};entries.unshift(entry);}return respond(entry);
        }
        if(name==='student_reinforcement_summary'){
          const mine=entries.filter(e=>e.student_id===params.p_student);
          return respond({total:mine.reduce((sum,e)=>sum+e.points,0),latest_id:mine[0]?.id??null,latest_points:mine[0]?.points??0,latest_at:mine[0]?.created_at??null});
        }
      }
      if(name==='classrooms')return respond([{id:room,name:'ห้องชื่อซ้ำ',room:'1'},{id:otherRoom,name:'ห้องชื่อซ้ำ',room:'2'}]);
      if(name==='attendance_records')return respond(url.searchParams.get('attendance_date')===`eq.${today}`&&url.searchParams.get('period')==='eq.1'?[{student_id:student(1)}]:[]);
      if(name==='student_avatar_customizations')return respond(null);
      let rows=name==='classroom_wheel_rounds'?rounds:name==='classroom_wheel_draws'?draws:name==='student_reinforcement_entries'?entries:[];
      rows=rows.filter(row=>[...url.searchParams].every(([key,value])=>{
        if(value.startsWith('eq.'))return String(row[key])===value.slice(3);
        if(value==='is.null')return row[key]==null;
        if(value.startsWith('in.('))return value.slice(4,-1).split(',').includes(String(row[key]));
        if(key==='created_at'&&value.startsWith('gte.'))return row.created_at>=value.slice(4);
        if(key==='created_at'&&value.startsWith('lt.'))return row.created_at<value.slice(3);
        return true;
      }));
      if(name==='student_reinforcement_entries'&&url.searchParams.has('student_id'))rows=rows.filter(row=>row.student_id===currentStudent);
      return respond(rows.slice(Number(url.searchParams.get('offset')??0),Number(url.searchParams.get('offset')??0)+Number(url.searchParams.get('limit')??1000)));
    });
    page.on('dialog',dialog=>dialog.accept());
    await page.goto('http://127.0.0.1:4356/tests/wheel-fixture.html');
    await expect(page.getByRole('button',{name:'เริ่มรอบสุ่ม',exact:true})).toBeEnabled();
    await expect(page.locator('.wheel-roster > label')).toHaveCount(39);
    await page.screenshot({path:`/tmp/wheel-full-${width}.png`,fullPage:true});
    await page.getByLabel('ห้องเรียน',{exact:true}).selectOption(otherRoom);
    await expect(page.locator('.wheel-roster > label')).toHaveCount(1);
    await expect(page.locator('.wheel-roster > label')).toContainText('นักเรียนอีกห้อง');
    await page.getByLabel('ห้องเรียน',{exact:true}).selectOption(room);
    await expect(page.locator('.wheel-roster > label')).toHaveCount(39);
    await page.getByLabel('เลือกทั้งหมด',{exact:true}).uncheck();
    for(const n of ['01','02'])await page.locator('.wheel-roster > label').filter({hasText:`นักเรียนทดสอบ ${n}`}).getByRole('checkbox').check();
    await page.getByRole('button',{name:'เริ่มรอบสุ่ม',exact:true}).click();
    await expect(page.getByRole('button',{name:'หมุนวงล้อ',exact:true})).toBeEnabled();
    await page.getByRole('button',{name:'หมุนวงล้อ',exact:true}).click();
    await expect(page.getByRole('button',{name:'กำลังหมุนวงล้อ',exact:true})).toBeDisabled();
    const before=await page.locator('.wheel-stage canvas').evaluate(canvas=>getComputedStyle(canvas).transform);
    await page.waitForTimeout(250);
    const after=await page.locator('.wheel-stage canvas').evaluate(canvas=>getComputedStyle(canvas).transform);
    assert.notEqual(before,after,'Wheel must visibly move');
    await expect(page.getByRole('region',{name:'ผลการสุ่ม'})).toBeVisible({timeout:8000});
    await expect(page.getByRole('region',{name:'ผลการสุ่ม'}).getByRole('heading',{name:'นักเรียนทดสอบ 01',exact:true})).toBeVisible();
    const colors=await page.locator('.wheel-stage canvas').evaluate(c=>{const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;const set=new Set();for(let i=0;i<p.length;i+=400)set.add(`${p[i]},${p[i+1]},${p[i+2]}`);return set.size;});
    assert(colors>8,'Wheel must have rendered colors and labels');
    const award=page.getByRole('region',{name:'ผลการสุ่ม'});
    await award.getByRole('button',{name:'+3',exact:true}).click();
    await award.getByRole('button',{name:'เพิ่มแต้มเสริมแรง',exact:true}).click();
    await award.getByRole('button',{name:'ยืนยันให้แต้ม',exact:true}).click();
    await expect(award.getByRole('alert')).toContainText('ติดต่อระบบไม่สำเร็จ');
    await expect(award.getByLabel('จำนวนเอง')).toHaveValue('3');
    await award.getByRole('button',{name:'ยืนยันให้แต้ม',exact:true}).click();
    await expect(award.getByText(/บันทึก \+3 แต้มแล้ว/)).toBeVisible();
    assert.equal(entries.filter(e=>e.points>0).length,1,'Lost response retry must not double award');
    await page.screenshot({path:`/tmp/wheel-result-${width}.png`,fullPage:true});
    await page.reload();
    await expect(page.getByText('เหลือ 1 จาก 2 คน',{exact:true})).toBeVisible();
    await expect(page.getByRole('region',{name:'ผลการสุ่ม'}).getByText(/บันทึก \+3 แต้มแล้ว/)).toBeVisible();
    loseSpin=true;
    await page.getByRole('button',{name:'สุ่มคนถัดไป',exact:true}).click();
    await expect(page.getByRole('alert').first()).toContainText('ติดต่อระบบไม่สำเร็จ');
    await page.reload();
    await expect(page.getByRole('region',{name:'ผลการสุ่ม'}).getByRole('heading',{name:'นักเรียนทดสอบ 02',exact:true})).toBeVisible();
    await expect(page.getByText('เหลือ 0 จาก 2 คน',{exact:true})).toBeVisible();
    assert.equal(draws.length,2);
    await page.getByRole('tab',{name:'แต้มเสริมแรง',exact:true}).click();
    await page.getByRole('button',{name:'ยกเลิกแต้ม นักเรียนทดสอบ 01',exact:true}).click();
    const correction=page.getByRole('dialog',{name:'ยกเลิกรายการให้แต้ม'});
    await correction.getByLabel('เหตุผลการยกเลิก').fill('ให้แต้มผิดรายการ');
    await correction.getByRole('button',{name:'ยืนยันยกเลิกแต้ม'}).click();
    await expect(correction).toHaveCount(0);
    await expect(page.getByText('ยกเลิกแล้ว',{exact:true})).toBeVisible();
    assert.equal(entries.reduce((sum,e)=>sum+e.points,0),0);
    await page.getByLabel('ผู้เข้าร่วม',{exact:true}).selectOption('present');
    await expect(page.locator('.wheel-roster > label')).toHaveCount(1);
    await page.getByRole('button',{name:'ใช้ตัวเลือกนี้และเริ่มรอบใหม่',exact:true}).click();
    await expect(page.getByRole('button',{name:'หมุนวงล้อ',exact:true})).toBeEnabled();
    assert.deepEqual(rounds.at(-1).participant_ids,[student(1)]);
    await page.getByLabel('วันที่',{exact:true}).first().fill('2020-01-01');
    await expect(page.getByText('ยังไม่มีผู้เช็คชื่อว่ามาหรือมาสายในวันและคาบนี้')).toBeVisible();
    await expect(page.getByRole('button',{name:'ใช้ตัวเลือกนี้และเริ่มรอบใหม่',exact:true})).toBeDisabled();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const studentPage=await context.newPage();
    await studentPage.goto('http://127.0.0.1:4356/tests/wheel-fixture.html?mode=student');
    await expect(studentPage.getByRole('heading',{name:'แต้มเสริมแรง',exact:true})).toBeVisible();
    await expect(studentPage.getByText('ให้แต้มผิดรายการ',{exact:true})).toBeVisible();
    await expect(studentPage.locator('.reward-balance-open strong')).toHaveText('0');
    await studentPage.screenshot({path:`/tmp/wheel-student-points-${width}.png`,fullPage:true});
    assert.equal(spinCalls,2);
    const reduced=await context.newPage();
    await reduced.emulateMedia({reducedMotion:'reduce'});
    await reduced.goto('http://127.0.0.1:4356/tests/wheel-fixture.html');
    await expect(reduced.getByRole('button',{name:'หมุนวงล้อ',exact:true})).toBeEnabled();
    await reduced.getByRole('button',{name:'หมุนวงล้อ',exact:true}).click();
    await expect(reduced.getByRole('region',{name:'ผลการสุ่ม'})).toBeVisible({timeout:1500});
    await expect(reduced.getByRole('button',{name:'สุ่มคนถัดไป',exact:true})).toBeDisabled();
    const balancePage=await context.newPage();
    await balancePage.goto('http://127.0.0.1:4356/tests/wheel-fixture.html?mode=balance');
    await expect(balancePage.locator('.reward-balance-open strong')).toHaveText('0');
    entries.unshift({...entries.find(e=>e.points>0),id:crypto.randomUUID(),draw_id:crypto.randomUUID(),points:2,reason:'แต้มใหม่',created_at:nowForTest()});
    await balancePage.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await expect(balancePage.locator('.reward-balance-open strong')).toHaveText('2');
    await expect(balancePage.getByText('ได้รับ +2 แต้ม',{exact:true})).toBeVisible();
    await balancePage.reload();
    await expect(balancePage.locator('.reward-balance-open strong')).toHaveText('2');
    await expect(balancePage.locator('.reward-new')).toHaveCount(0);
    assert((await balancePage.locator('.reward-balance').boundingBox()).height<80,'Student points must stay compact');
    await context.close();
  }
  console.log('PASS desktop/mobile: actual wheel motion and canvas pixels, duplicate-named rooms by ID, roster exclusions, no repeat/reload, lost spin/award responses, one award only, reversal, attendance, student balance/history and no overflow');
}finally{await browser?.close();server.kill();}
function nowForTest(){return new Date().toISOString();}
