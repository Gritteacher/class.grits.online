import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const packageJson=JSON.parse(readFileSync('package.json','utf8'));
assert.ok(!Object.keys(packageJson.dependencies).some(name=>name.startsWith('@line/')));
assert.ok(!readFileSync('.env.example','utf8').includes('LINE_CHANNEL'));
assert.ok(!readFileSync('supabase/schema.sql','utf8').includes('line_account_links'));
const server=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4343','--strictPort'],{env:{...process.env,VITE_SUPABASE_URL:'https://example.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'test'},stdio:'pipe'});
let browser;
try {
  await new Promise((resolve,reject)=>{server.stdout.on('data',data=>{if(data.toString().includes('4343'))resolve();});server.on('exit',code=>reject(Error(`Vite exited ${code}`)));});
  browser=await chromium.launch({channel:'chrome'});
  for(const width of [1280,390]) {
    const page=await browser.newPage({viewport:{width,height:900},userAgent:'Mozilla/5.0 Mobile Safari LINE/14.0'});
    const lineRequests=[];
    page.on('request',request=>{if(/(^|\.)(line\.me|line\.biz|line-scdn\.net)$/.test(new URL(request.url()).hostname))lineRequests.push(request.url());});
    await page.goto('http://127.0.0.1:4343/?liff.state=%2F&liffClientId=retired');
    await expect(page.getByLabel('รหัสนักเรียน',{exact:true})).toBeVisible();
    await expect(page.getByLabel('รหัสผ่าน',{exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:/LINE|ไลน์/i})).toHaveCount(0);
    await page.getByRole('button',{name:'เข้าสู่ระบบสำหรับครู'}).click();
    await expect(page.getByLabel('อีเมลครู',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'กลับหน้าสำหรับนักเรียน'}).click();
    await page.getByRole('button',{name:'ลืมรหัสผ่าน?'}).click();
    await expect(page.getByLabel('อีเมลที่ลงทะเบียนไว้',{exact:true})).toBeVisible();
    await page.goto('http://127.0.0.1:4343/');
    await expect(page.getByLabel('รหัสนักเรียน',{exact:true})).toBeVisible();
    await page.screenshot({path:`/tmp/direct-web-login-${width}.png`,fullPage:true});
    assert.deepEqual(lineRequests,[],'No LINE SDK or authentication request may be made');
    await page.close();
  }
  console.log('Passed web-only entry on desktop/mobile, legacy LINE params, teacher login and password recovery forms; no LINE network requests.');
} finally {await browser?.close();server.kill();}
