import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const server = spawn('node', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '4356', '--strictPort'], {env:{...process.env,VITE_SUPABASE_URL:'https://example.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'test'},stdio:'pipe'});
let browser;
try {
  await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(d.toString().includes('4356'))resolve();});server.on('exit',reject);});
  browser=await chromium.launch({channel:'chrome'});
  for(const width of [390,889,1280]) {
    const page=await browser.newPage({viewport:{width,height:1100}});
    const id='00000000-0000-4000-8000-000000000002';
    const exp=Math.floor(Date.now()/1000)+3600;
    const token=[{alg:'HS256'},{sub:id,exp,role:'authenticated'}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.')+'.test';
    await page.addInitScript(session=>localStorage.setItem('sb-example-auth-token',JSON.stringify(session)),{access_token:token,refresh_token:'test',expires_at:exp,user:{id,aud:'authenticated',role:'authenticated'}});
    let saved=null, writes=0, uploadFails=true, saveFails=true;
    await page.route('https://example.supabase.co/**',async route=>{
      const req=route.request(),u=new URL(req.url()),p=u.pathname;
      let body=[];
      const student={id,role:'student',display_name:'นักเรียนทดสอบ',student_code:'00001',recovery_email:'test@example.test',status:'active'};
      if(p.endsWith('/profiles'))body=u.searchParams.has('role')?[student]:student;
      if(p.endsWith('/classroom_members'))body=[{classroom_id:'room1',student_id:id,student_number:1}];
      if(p.endsWith('/classrooms'))body=[{id:'room1',name:'ม.6/1',room:'1',level:'ม.6',subject:'สังคมศึกษา'}];
      if(p.endsWith('/assignments'))body=[{id:'work1',title:'ใบงานทดสอบ',description:'ส่งไฟล์ทดสอบ',category:'ใบงาน',raw_max:10,final_max:10,due_at:'2027-12-31T00:00:00Z',submission_required:true,submission_mode:'individual',group_size:1}];
      if(p.endsWith('/assignment_classrooms'))body=[{assignment_id:'work1',classroom_id:'room1'}];
      if(p.endsWith('/submissions')){
        if(req.method()==='POST'){
          if(saveFails)return route.fulfill({status:403,json:{code:'42501',message:'new row violates row-level security policy'}});
          writes++;saved={...req.postDataJSON(),id:'saved1'};body=null;
        }
        else body=u.searchParams.get('select')==='file_path'?null:saved?[saved]:[];
      }
      if(p.includes('/storage/v1/object/classroom-files/')) {
        if(uploadFails)return route.fulfill({status:403,json:{statusCode:'403',message:'new row violates row-level security policy',error:'Unauthorized'}});
        body={Key:'file'};
      }
      if(p.endsWith('/storage/v1/object/sign/classroom-files'))body=[{path:saved.file_path,signedURL:'/object/sign/classroom-files/file?token=test'}];
      if(p.endsWith('/rpc/student_reinforcement_summary'))body={total:0,latest_id:null,latest_points:0,latest_at:null};
      return route.fulfill({json:body});
    });
    await page.goto('http://127.0.0.1:4356/');
    await page.getByRole('button',{name:'ส่งงาน',exact:true}).first().click();
    const dialog=page.getByRole('dialog');
    await dialog.getByRole('button',{name:'แนบไฟล์',exact:true}).click();
    await dialog.locator('input[type=file]').setInputFiles({name:'work.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 test')});
    await dialog.getByRole('button',{name:'ยืนยันส่งงาน',exact:true}).click();
    await expect(dialog.getByRole('alert')).toContainText('ไม่มีสิทธิ์');
    await expect(dialog.locator('.upload-area strong')).toHaveText('work.pdf');
    assert.equal(writes,0);
    uploadFails=false;
    await dialog.getByRole('button',{name:'ยืนยันส่งงาน',exact:true}).click();
    await expect(dialog.getByRole('alert')).toContainText('บันทึกงานไม่สำเร็จ');
    await expect(dialog.locator('.upload-area strong')).toHaveText('work.pdf');
    assert.equal(writes,0);
    saveFails=false;
    await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError');};});
    await dialog.getByRole('button',{name:'ยืนยันส่งงาน',exact:true}).click();
    await expect(dialog).toHaveCount(0);
    assert.equal(writes,1,'Full cache must not cause a saved submission to be reported as failed');
    await page.screenshot({path:`/tmp/submission-saved-${width}.png`,fullPage:true});
    await page.reload();
    await expect(page.getByRole('button',{name:'ส่งงาน',exact:true})).toHaveCount(0);
    assert.equal(writes,1);
    await page.close();
  }
  console.log('PASS mobile/tablet/desktop: upload and database errors in dialog, file retained for retry, server save succeeds with full local cache, reload does not resubmit');
} finally {await browser?.close();server.kill();}
