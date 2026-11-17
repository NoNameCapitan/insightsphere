const { chromium } = require('/opt/codex/cua_node/lib/node_modules/playwright');
const { expect } = require('/opt/codex/cua_node/lib/node_modules/playwright/test');
const fs = require('node:fs');
const results=[];
const base='http://127.0.0.1:3001';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 async function scenario(name,run,viewport={width:390,height:844}) {
  if(process.env.QA_ONLY && !new RegExp(process.env.QA_ONLY).test(name)) return;
  const context=await browser.newContext({viewport,deviceScaleFactor:1,reducedMotion:'reduce',serviceWorkers:'block'});
  const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  try {await run(page,context); expect(errors).toEqual([]);results.push({name,status:'passed'});}
  catch(e){results.push({name,status:'failed',error:e.message}); await page.screenshot({path:'/workspace/work/screenshots-v132/qa-failure-'+results.length+'.png',fullPage:true});}
  finally{await context.close(); console.log(name,results.at(-1).status);}
 }
 await scenario('Responsive home: 320, 390, 640, 768, 1024 and 1440 px; primary search visible',async page=>{
  for(const width of [320,390,640,768,1024,1440]){
   await page.setViewportSize({width,height:width===1440?1000:844}); await page.goto(base,{waitUntil:'networkidle'});
   await expect(page.getByRole('heading',{level:1})).toContainText('Турбота про тих');
   await expect(page.getByRole('button',{name:'Знайти поруч',exact:true})).toBeInViewport();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   if(width===390||width===1440){await page.screenshot({path:`/workspace/work/screenshots-v132/final-home-${width}.png`});await page.screenshot({path:`/workspace/work/screenshots-v132/final-home-${width}-full.png`,fullPage:true});}
  }
 });
 await scenario('Home animal and service selection reaches matching search',async page=>{
  await page.goto(base); await page.getByLabel('Для кого шукаємо?').selectOption('bird');await page.getByLabel('Що потрібно?').selectOption('vet_pharmacy');
  await page.getByRole('button',{name:'Знайти поруч',exact:true}).click();
  await expect(page).toHaveURL(/animal=bird&category=vet_pharmacy/);await expect(page.locator('p').filter({hasText:'У результатах — лише заклади, де вказано прийом:'})).toContainText('Птах');
 });
 await scenario('Failed geocoding never silently chooses Kyiv; named location must be selected',async page=>{
  let response=[];
  await page.route('https://nominatim.openstreetmap.org/search?**',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)}));
  await page.goto(base+'/nearby?location=manual');
  await page.getByRole('textbox',{name:'Вкажіть місцезнаходження'}).fill('Невідома адреса');
  await page.getByRole('button',{name:'Знайти',exact:true}).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('Адресу не знайдено');
  await expect(page.getByText('Без локації показуємо доступний каталог, без відстаней.')).toBeVisible();
  await page.screenshot({path:'/workspace/work/screenshots-v132/final-address-error.png'});
  response=[{lat:'49.84',lon:'24.03',display_name:'Львів, Львівська область, Україна'}];
  await page.getByRole('textbox',{name:'Вкажіть місцезнаходження'}).fill('Львів');await page.getByRole('button',{name:'Знайти',exact:true}).click();
  await expect(page.getByRole('button',{name:'Львів, Львівська область, Україна',exact:true})).toBeVisible();
  await expect(page.getByText('Без локації показуємо доступний каталог, без відстаней.')).toBeVisible();
  await page.getByRole('button',{name:'Львів, Львівська область, Україна',exact:true}).click();
  await expect(page.getByText('Пошук від обраної точки')).toBeVisible();await expect(page.getByText('За цими фільтрами нічого не знайдено')).toBeVisible();
  await expect(page.getByText('відсутність результатів не означає',{exact:false})).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('vetnear:coords'))).toBeNull();
 });
 await scenario('Name search, empty recovery and progressive result loading',async page=>{
  await page.goto(base+'/nearby?location=manual');
  await expect(page.getByRole('button',{name:'Показати ще 12',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Показати ще 12',exact:true}).click();await expect(page.getByText('Показано 24 із 90')).toBeVisible();
  const input=page.getByRole('searchbox',{name:'Назва закладу або адреса'});
  await input.fill('MAVET'); await expect(page.getByRole('link',{name:'MAVET Clinic & Groom',exact:true})).toBeVisible();
  await input.fill('zzzznonexistent');await expect(page.getByRole('heading',{name:'За цією назвою нічого не знайдено'})).toBeVisible();
  await page.getByRole('button',{name:'Очистити пошук',exact:true}).click();await expect(input).toHaveValue('');
  await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/workspace/work/screenshots-v132/final-nearby-mobile.png'});
 });
 await scenario('Keyboard radius selection and map toggle',async page=>{
  await page.goto(base+'/nearby?location=manual');
  const radius=page.getByRole('radio',{name:'3 км',exact:true});await radius.focus();await radius.press('ArrowRight');await expect(page.getByRole('radio',{name:'5 км',exact:true})).toBeChecked();
  await page.getByRole('button',{name:'Карта',exact:true}).click();await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect(page.getByRole('button',{name:'Карта',exact:true})).toHaveAttribute('aria-pressed','true');
 });
 await scenario('Urgent navigation opens direct urgent action without need selection',async page=>{
  await page.goto(base);await page.getByRole('navigation',{name:'Основна навігація'}).getByRole('link',{name:'Терміново',exact:true}).click();
  await expect(page.getByRole('heading',{level:1})).toHaveText('Допомога у терміновій ситуації');
  await expect(page.getByRole('link',{name:'Показати найближчі ветклініки',exact:false})).toBeVisible();
  await expect(page.getByRole('button',{name:'Купити корм / ліки / товари',exact:false})).toHaveCount(0);
  await page.screenshot({path:'/workspace/work/screenshots-v132/final-urgent-mobile.png'});
 });
 await scenario('Pet profile and record: explicit next date, storage failure retains input',async page=>{
  await page.goto(base+'/my-pets/new');
  await page.getByLabel('Ім’я *',{exact:true}).fill('Тестова Пташка');await page.getByLabel('Вид',{exact:true}).selectOption('bird');
  await page.getByRole('button',{name:'Продовжити',exact:true}).click();await page.getByRole('button',{name:'Продовжити',exact:true}).click();
  await page.getByRole('button',{name:'Створити медкартку',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Тестова Пташка',exact:true})).toBeVisible();
  await page.getByRole('link',{name:'Додати запис',exact:true}).click();
  await expect(page).toHaveURL(/records\/new$/);
  await expect(page.getByLabel('Наступна дата · необов’язково',{exact:true})).toHaveValue('');
  await page.getByLabel('Назва вакцини',{exact:true}).fill('Тестовий запис ветеринара');
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Quota exceeded','QuotaExceededError')};});
  await page.getByRole('button',{name:'Зберегти запис',exact:true}).click();
  await expect(page.locator('main').getByRole('alert')).toBeVisible();await expect(page.getByLabel('Назва вакцини',{exact:true})).toHaveValue('Тестовий запис ветеринара');
  await expect(page).toHaveURL(/records\/new$/);
  await page.evaluate(()=>{document.activeElement?.blur();scrollTo(0,0)});await page.screenshot({path:'/workspace/work/screenshots-v132/final-record-storage-error.png'});
 });
 await scenario('Active pet updates animal filter and manual location survives return without GPS',async(page,context)=>{
  await context.addInitScript(()=>{
   if(!localStorage.getItem('qa-seeded')){
    localStorage.setItem('vetnear:pets',JSON.stringify([{id:'qa-cat',name:'Тестовий кіт',animalType:'cat',createdAt:'2026-11-16T00:00:00.000Z',updatedAt:'2026-11-16T00:00:00.000Z'},{id:'qa-bird',name:'Тестовий птах',animalType:'bird',createdAt:'2026-11-16T00:00:00.000Z',updatedAt:'2026-11-16T00:00:00.000Z'}]));
    localStorage.setItem('vetnear:active-pet',JSON.stringify('qa-cat'));localStorage.setItem('qa-seeded','1');
   }
   window.qaGeoCalls=0;
   Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(){window.qaGeoCalls+=1;}}});
  });
  await page.goto(base+'/nearby?animal=dog&location=manual');
  await expect(page.getByLabel('Активний улюбленець')).toHaveValue('');
  await page.getByLabel('Активний улюбленець').selectOption('qa-bird');
  await expect(page.locator('p').filter({hasText:'У результатах — лише заклади, де вказано прийом:'})).toContainText('Птах');
  await page.getByRole('button',{name:'Київ — Поділ',exact:true}).click();
  await expect(page.getByText('Пошук від обраної точки')).toBeVisible();
  await page.goto(base+'/nearby');await expect(page.getByText('Пошук від обраної точки')).toBeVisible();
  expect(await page.evaluate(()=>window.qaGeoCalls)).toBe(0);
 });
 await scenario('Denied geolocation disclosure can close and reopen accessibly',async(page,context)=>{
  await context.addInitScript(()=>Object.defineProperty(navigator,'geolocation',{configurable:true,value:{getCurrentPosition(_ok,fail){fail({code:1,PERMISSION_DENIED:1})}}}));
  await page.goto(base+'/nearby');await page.getByRole('button',{name:'Визначити',exact:true}).click();
  const toggle=page.getByRole('button',{name:'Згорнути',exact:true});await expect(toggle).toHaveAttribute('aria-expanded','true');
  await toggle.click();await expect(page.getByRole('textbox',{name:'Вкажіть місцезнаходження'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Вказати вручну',exact:true})).toHaveAttribute('aria-expanded','false');
 });
 await scenario('Cinematic hero respects reduced motion and desktop motion toggle',async page=>{
  await page.setViewportSize({width:1440,height:1000});await page.goto(base);
  const hero=page.locator('section[aria-labelledby="home-title"]');
  await expect(hero.getByRole('button',{name:'Рух зменшено в налаштуваннях системи'})).toBeDisabled();
  await expect(hero.locator('[data-motion]')).toHaveAttribute('data-motion','off');
  await page.emulateMedia({reducedMotion:'no-preference'});
  const toggle=hero.getByRole('button',{name:'Вимкнути рух ілюстрації'});await expect(toggle).toBeEnabled();await toggle.click();
  await expect(hero.locator('[data-motion]')).toHaveAttribute('data-motion','off');
  await hero.getByRole('button',{name:'Увімкнути рух ілюстрації'}).click();await expect(hero.locator('[data-motion]')).toHaveAttribute('data-motion','on');
  await page.getByRole('link',{name:'Дослідити карту районів'}).click();await expect(page.locator('#district-explorer')).toBeInViewport();
 });
 await scenario('Partner plans and local interest: no payment, correct draft, consent resets',async page=>{
  for(const width of [390,1440]){await page.setViewportSize({width,height:1000});await page.goto(base+'/for-partners');await expect(page.getByRole('heading',{level:1})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'/workspace/work/screenshots-v132/final-partners-'+width+'.png'});}
  await page.setViewportSize({width:390,height:844});await page.goto(base+'/partner-interest?plan=pro&founding=1');
  await expect(page.getByLabel('Що хочете обговорити?')).toHaveValue('pro');await expect(page.getByRole('checkbox').first()).toBeChecked();
  await page.getByLabel('Назва закладу *',{exact:true}).fill('QA тестова клініка');await page.getByLabel('Місто або село *',{exact:true}).fill('Біла Церква');await page.getByLabel('Робочий email *',{exact:true}).fill('qa@example.test');
  await page.getByRole('checkbox').last().check();await page.getByRole('button',{name:'Зберегти чернетку на пристрої'}).click();
  await expect(page.getByRole('heading',{name:'Чернетка лише на вашому пристрої'})).toBeVisible();await expect(page.getByText('Не активована',{exact:true})).toBeVisible();await expect(page.getByText('Не стягувалася',{exact:true})).toBeVisible();
  await page.screenshot({path:'/workspace/work/screenshots-v132/final-partner-local-receipt.png'});
  await page.reload();await expect(page.getByLabel('Назва закладу *',{exact:true})).toHaveValue('QA тестова клініка');await expect(page.getByLabel('Що хочете обговорити?')).toHaveValue('pro');await expect(page.getByRole('checkbox').last()).not.toBeChecked();
  await page.goto(base+'/partner/dashboard');await expect(page.getByText('Не активована',{exact:true}).first()).toBeVisible();
 });
 await scenario('Partner draft quota failure retains the form and never claims delivery',async page=>{
  await page.goto(base+'/partner-interest');await page.getByLabel('Назва закладу *',{exact:true}).fill('QA без сховища');await page.getByLabel('Робочий email *',{exact:true}).fill('qa@example.test');await page.getByRole('checkbox').last().check();
  await page.evaluate(()=>{Storage.prototype.setItem=function(){throw new DOMException('Quota exceeded','QuotaExceededError')};});
  await page.getByRole('button',{name:'Зберегти чернетку на пристрої'}).click();await expect(page.locator('main').getByRole('alert')).toContainText('Браузер не дозволив');await expect(page.getByLabel('Назва закладу *',{exact:true})).toHaveValue('QA без сховища');await expect(page.getByText('Заявку отримано для розгляду',{exact:true})).toHaveCount(0);
 });
 const noJs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844},serviceWorkers:'block'});
 try {const p=await noJs.newPage();await p.goto(base);await p.getByLabel('Для кого шукаємо?').selectOption('cat');await p.getByRole('button',{name:'Знайти поруч',exact:true}).click();await expect(p).toHaveURL(/animal=cat/);results.push({name:'Home GET search works without JavaScript',status:'passed'});}catch(e){results.push({name:'Home GET search works without JavaScript',status:'failed',error:e.message});}finally{await noJs.close();}
 await browser.close();
 fs.writeFileSync('/workspace/work/browser-qa-v132-results'+(process.env.QA_ONLY?'-retry':'')+'.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results,null,2));
 if(results.some(r=>r.status!=='passed'))process.exit(1);
})().catch(e=>{console.error(e);process.exit(1)});
