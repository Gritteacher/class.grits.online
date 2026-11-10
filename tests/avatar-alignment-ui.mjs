import{chromium}from'@playwright/test';import{spawn}from'node:child_process';
const server=spawn('node',['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4350','--strictPort'],{env:{...process.env,VITE_SUPABASE_URL:'https://example.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'test'},stdio:'pipe'});let browser;
try{await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(d.toString().includes('4350'))resolve();});server.on('exit',reject);});browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage({viewport:{width:1280,height:1100}});await page.goto('http://127.0.0.1:4350/tests/avatar-fixture.html');
await page.evaluate(async()=>{
  const {renderAvatar}=await import('/src/avatar/render.ts');
  const {defaultAvatar}=await import('/src/avatar/model.ts');
  for(let outfit=0;outfit<12;outfit++){
    const c=document.createElement('canvas');
    await renderAvatar(c,{...defaultAvatar,outfit});
    const ctx=c.getContext('2d'),bg=ctx.getImageData(0,0,1,1).data;
    for(const [x,y] of [[256,402],[256,420]]){
      const color=ctx.getImageData(x,y,1,1).data;
      if(color.slice(0,3).every((n,j)=>Math.abs(n-bg[j])<3))throw Error(`Collar gap in outfit ${outfit}`);
    }
  }
  for(let face=0;face<4;face++)for(let accessory=0;accessory<2;accessory++){
    const c=document.createElement('canvas'),base=document.createElement('canvas');
    await renderAvatar(c,{...defaultAvatar,face,accessory});
    await renderAvatar(base,{...defaultAvatar,face,accessory:-1});
    const a=c.getContext('2d').getImageData(0,0,512,640).data,b=base.getContext('2d').getImageData(0,0,512,640).data;
    let changed=0,minY=640,maxY=0;
    for(let p=0;p<a.length;p+=4){
      if(Math.max(...[0,1,2].map(j=>Math.abs(a[p+j]-b[p+j])))<20)continue;
      const y=Math.floor(p/4/512);changed++;minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    }
    if(changed<500||minY<160||maxY>248)throw Error(`Glasses outside eye band: ${face}/${accessory}`);
  }
});
for(const kind of ['outfits','glasses','accessories']){
await page.evaluate(async(kind)=>{const{renderAvatar}=await import('/src/avatar/render.ts');const{defaultAvatar}=await import('/src/avatar/model.ts');const count=kind==='outfits'?12:kind==='glasses'?8:8;const sheet=document.createElement('canvas');sheet.width=1024;sheet.height=Math.ceil(count/4)*350;const ctx=sheet.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,sheet.width,sheet.height);for(let i=0;i<count;i++){const c=document.createElement('canvas');const value={...defaultAvatar,face:kind==='glasses'?Math.floor(i/2):0,hair:5,outfit:kind==='outfits'?i:8,accessory:kind==='glasses'?i%2:kind==='accessories'?Math.floor(i/2)%4:-1};if(kind==='accessories')value.hair=i%2===0?0:3;await renderAvatar(c,value);ctx.drawImage(c,i%4*256,Math.floor(i/4)*350,256,320);ctx.fillStyle='#173d38';ctx.font='14px sans-serif';ctx.fillText(`${kind} ${i}`,i%4*256+8,Math.floor(i/4)*350+340);}document.body.replaceChildren(sheet);},kind);await page.locator('canvas').screenshot({path:`/tmp/avatar-alignment-${kind}.png`});}
console.log('PASS: 12 collar gap checks, 8 glasses eye-band checks, 3 visual contact sheets');
}finally{await browser?.close();server.kill();}
