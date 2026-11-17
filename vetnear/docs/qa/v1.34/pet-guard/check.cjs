const {chromium}=require('/opt/codex/cua_node/lib/node_modules/playwright');
const {expect}=require('/opt/codex/cua_node/lib/node_modules/playwright/test');
const fs=require('node:fs');
const base='http://127.0.0.1:3003';
const key='vetnear:pets';
const out=__dirname;
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const results=[];
 for(const [label,raw]of [['object','{"unexpected":true}'],['null-member','[null]']]){
  const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
  await ctx.addInitScript(()=>{window.__qaPetWrites=[];const set=Storage.prototype.setItem;const remove=Storage.prototype.removeItem;Storage.prototype.setItem=function(k,v){if(k==='vetnear:pets')window.__qaPetWrites.push({op:'set',value:v});return set.call(this,k,v)};Storage.prototype.removeItem=function(k){if(k==='vetnear:pets')window.__qaPetWrites.push({op:'remove'});return remove.call(this,k)};});
  const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
  try{
   await p.goto(base+'/my-pets',{waitUntil:'domcontentloaded'});
   await p.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw});
   await p.reload({waitUntil:'domcontentloaded'});
   await expect(p.locator('main').getByRole('alert')).toContainText('Картки не завантажилися');
   await expect(p.getByText('Турбота починається',{exact:false})).toHaveCount(0);
   expect(await p.evaluate(k=>localStorage.getItem(k),key)).toBe(raw);
   expect(await p.evaluate(()=>window.__qaPetWrites)).toEqual([]);
   if(label==='object')await p.screenshot({path:out+'/01-corrupt-read-mobile.png'});
   await p.getByRole('button',{name:'Спробувати ще раз',exact:true}).click();
   await expect(p.locator('main').getByRole('alert')).toContainText('Картки не завантажилися');
   expect(await p.evaluate(()=>window.__qaPetWrites)).toEqual([]);
   await p.goto(base+'/my-pets/new',{waitUntil:'domcontentloaded'});
   await p.getByLabel('Ім’я тварини *',{exact:true}).fill('Луна QA');
   await p.getByRole('button',{name:'Створити медкартку',exact:true}).click();
   await expect(p.locator('main').getByRole('alert')).toContainText('Щоб не втратити дані');
   await expect(p.getByLabel('Ім’я тварини *',{exact:true})).toHaveValue('Луна QA');
   expect(new URL(p.url()).pathname).toBe('/my-pets/new');
   expect(await p.evaluate(k=>localStorage.getItem(k),key)).toBe(raw);
   expect(await p.evaluate(()=>window.__qaPetWrites)).toEqual([]);
   if(label==='object')await p.screenshot({path:out+'/02-create-preserved-mobile.png'});
   await p.goto(base+'/my-pets',{waitUntil:'domcontentloaded'});
   await expect(p.locator('main').getByRole('alert')).toContainText('Картки не завантажилися');
   const recovery=JSON.stringify([{id:'qa-recovery',name:'Луна QA',animalType:'cat',createdAt:'2024-01-01T10:00:00Z',updatedAt:'2024-01-01T10:00:00Z'}]);
   await p.evaluate(({key,recovery})=>{localStorage.setItem(key,recovery);window.__qaPetWrites=[]},{key,recovery});
   await p.getByRole('button',{name:'Спробувати ще раз',exact:true}).click();
   await expect(p.locator('main').getByRole('alert')).toHaveCount(0);
   await expect(p.getByRole('heading',{name:'Луна QA',exact:true})).toBeVisible();
   expect(await p.evaluate(()=>window.__qaPetWrites)).toEqual([]);
   expect(await p.evaluate(k=>localStorage.getItem(k),key)).toBe(recovery);
   expect(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   expect(errors).toEqual([]);
   results.push({case:label,passed:true,checks:['explicit read alert','no first-time onboarding','retry preserves damaged bytes','create failure retains input','no navigation on failed write','no hidden medical writes','retry displays restored legacy record','no browser errors or overflow']});
  }catch(e){results.push({case:label,passed:false,error:e.message});await p.screenshot({path:out+'/failure-'+label+'.png'});}
  await ctx.close();
 }
 fs.writeFileSync(out+'/results.json',JSON.stringify(results,null,2));
 await browser.close();console.log(JSON.stringify(results,null,2));if(results.some(r=>!r.passed))process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
