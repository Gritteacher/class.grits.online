import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const server = spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4341','--strictPort'],{env:{...process.env,VITE_SUPABASE_URL:'https://example.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'test'},stdio:'pipe'});
let browser;
try {
  await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(d.toString().includes('4341'))resolve();});server.on('exit',code=>reject(Error(`Vite exited ${code}`)));});
  browser=await chromium.launch({channel:'chrome'});
  for(const width of [1280,390,320]) {
    const room='11111111-1111-4111-8111-111111111111';
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok'}).format(new Date());
    const records=[{id:'old',classroom_id:room,student_id:'s0',attendance_date:day,period:1,status:'late',note:'รถติด'}];
    const leaves=[{id:'approved',classroom_id:room,student_id:'s1',starts_on:day,ends_on:day,reason:'ลากิจ',status:'approved',review_note:'',created_at:day},
      {id:'pending',classroom_id:room,student_id:'s2',starts_on:day,ends_on:day,reason:'ธุระครอบครัว',status:'pending',review_note:'',created_at:day}];
    let fail=false;
    const page=await browser.newPage({viewport:{width,height:1100}});
    let role='teacher';
    await page.route('https://example.supabase.co/rest/v1/**',async route=>{
      const request=route.request(),url=new URL(request.url()),table=url.pathname.split('/').at(-1),method=request.method();
      const respond=body=>route.fulfill({json:body});
      if(table==='classrooms')return respond((role==='teacher'?[room,'22222222-2222-4222-8222-222222222222']:[room]).map(id=>({id,name:'ม.6/1',room:'6/1'})));
      if(table==='attendance_records'){
        if(fail)return route.fulfill({status:400,json:{message:'test failure'}});
        if(method==='POST'){
          await new Promise(r=>setTimeout(r,150));
          const rows=request.postDataJSON();
          for(const row of rows){const index=records.findIndex(r=>r.student_id===row.student_id&&r.attendance_date===row.attendance_date&&r.period===row.period&&r.classroom_id===row.classroom_id);if(index>=0)records[index]={...row,id:records[index].id};else records.push({...row,id:`new-${records.length}`});}
          return respond(rows.map((row,i)=>({id:`saved-${i}`})));
        }
        return respond(records.filter(row=>(role==='teacher'||row.student_id==='s0')&&url.searchParams.get('classroom_id')===`eq.${row.classroom_id}`));
      }
      assert.equal(table,'student_leave_requests');
      if(method==='POST'){const body=request.postDataJSON();const row={...body,id:'created',status:'pending',review_note:'',created_at:day};leaves.push(row);return respond({id:row.id});}
      if(method==='PATCH'){const body=request.postDataJSON();const id=url.searchParams.get('id').slice(3);const row=leaves.find(row=>row.id===id&&row.status==='pending');assert.ok(row);Object.assign(row,body);return respond({id:row.id});}
      let items=leaves.filter(row=>(role==='teacher'||row.student_id==='s0')&&url.searchParams.get('classroom_id')===`eq.${row.classroom_id}`);
      if(url.searchParams.has('student_id'))items=items.filter(row=>`eq.${row.student_id}`===url.searchParams.get('student_id'));
      if(url.searchParams.has('starts_on'))items=items.filter(row=>row.starts_on<=url.searchParams.get('starts_on').slice(4)&&row.ends_on>=url.searchParams.get('ends_on').slice(4)&&['pending','approved'].includes(row.status));
      return respond(items);
    });
    await page.goto('http://127.0.0.1:4341/tests/attendance-fixture.html?role=teacher');
    await expect(page.locator('.attendance-person')).toHaveCount(3);
    await expect(page.getByText('อนุมัติลาในวันนี้',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'เติมคนที่ยังไม่เช็ค'}).click();
    await expect(page.locator('.attendance-person').nth(0).getByRole('radio',{name:'สาย',exact:true})).toBeChecked();
    await expect(page.locator('.attendance-person').nth(1).getByRole('radio',{name:'ลา',exact:true})).toBeChecked();
    await page.getByRole('button',{name:'บันทึกเช็คชื่อ',exact:true}).click();
    await expect(page.getByText('บันทึกเช็คชื่อแล้ว',{exact:true})).toBeVisible();
    assert.equal(records.length,3);
    assert.equal(records.find(r=>r.student_id==='s0').status,'late');
    assert.equal(records.find(r=>r.student_id==='s1').status,'leave');
    await expect(page.locator('.attendance-person')).toHaveCount(3);
    await page.locator('.attendance-person').nth(2).getByRole('radio',{name:'ขาด',exact:true}).check();
    page.once('dialog',dialog=>dialog.dismiss());
    await page.getByLabel('คาบเรียน',{exact:true}).selectOption('2');
    await expect(page.getByLabel('คาบเรียน',{exact:true})).toHaveValue('1');
    await page.getByRole('button',{name:'บันทึกเช็คชื่อ',exact:true}).click();
    await expect(page.getByText('บันทึกเช็คชื่อแล้ว',{exact:true})).toBeVisible();
    await page.getByRole('tab',{name:/คำขอลา/}).click();
    await expect(page.locator('.leave-item')).toHaveCount(1);
    await page.getByRole('button',{name:'อนุมัติ',exact:true}).click();
    await page.getByLabel('ข้อความถึงนักเรียน (ไม่บังคับ)').fill('รับทราบ');
    await page.getByRole('button',{name:'ยืนยันผลการลา'}).click();
    await expect(page.getByText('บันทึกผลการลาแล้ว',{exact:true})).toBeVisible();
    assert.equal(leaves.find(r=>r.id==='pending').status,'approved');
    assert.equal(records.find(r=>r.student_id==='s2').status,'absent','approval must not overwrite recorded attendance');
    await page.getByRole('tab',{name:'เช็คชื่อ',exact:true}).click();
    await expect(page.locator('.attendance-person')).toHaveCount(3);
    await page.screenshot({path:`/tmp/attendance-teacher-${width}.png`,fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    fail=true;await page.getByRole('button',{name:'โหลดข้อมูลเช็คชื่อใหม่'}).click();
    await expect(page.getByRole('alert')).toContainText('โหลดประวัติเช็คชื่อไม่สำเร็จ');
    await expect(page.getByRole('button',{name:'บันทึกเช็คชื่อ',exact:true})).toHaveCount(0);
    fail=false;await page.getByRole('button',{name:'โหลดข้อมูลเช็คชื่อใหม่'}).click();
    await expect(page.locator('.attendance-person')).toHaveCount(3);
    role='student';await page.goto('http://127.0.0.1:4341/tests/attendance-fixture.html?role=student');
    await expect(page.locator('.attendance-history article')).toHaveCount(1);
    await expect(page.getByRole('tab',{name:'เช็คชื่อ',exact:true})).toHaveCount(0);
    await page.getByRole('tab',{name:'การลาของฉัน'}).click();
    await page.getByRole('button',{name:'ยื่นคำขอลา',exact:true}).click();
    await page.getByLabel('เหตุผลการลา').fill('ลากิจสำหรับทดสอบ');
    await page.getByRole('button',{name:'ส่งคำขอลา',exact:true}).click();
    await expect(page.getByText('ส่งคำขอลาแล้ว รอครูพิจารณา',{exact:true})).toBeVisible();
    await expect(page.locator('.leave-item')).toHaveCount(1);
    await page.getByRole('button',{name:'ยื่นคำขอลา',exact:true}).click();
    await page.getByLabel('เหตุผลการลา').fill('ซ้ำ');
    await page.getByRole('button',{name:'ส่งคำขอลา',exact:true}).click();
    await expect(page.getByRole('alert')).toContainText('มีคำขอลา');
    await page.getByRole('button',{name:'ยกเลิก',exact:true}).click();
    await page.screenshot({path:`/tmp/attendance-student-${width}.png`,fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.close();
  }
  console.log('Passed attendance persistence, existing marks, approved leaves, unsaved guard, teacher approval, student request/history, duplicate rejection, failure recovery and 3 viewport sizes.');
}finally{await browser?.close();server.kill();}
