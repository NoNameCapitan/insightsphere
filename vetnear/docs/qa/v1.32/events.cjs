const { chromium } = require('playwright');
const { expect } = require('playwright/test');
const fs = require('node:fs');
const base = 'http://127.0.0.1:3001';
(async()=>{
 const browser = await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const results=[];
 try {
  for(const [name,width,height] of [['desktop',1440,1000],['mobile',390,844]]) {
   const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce',serviceWorkers:'block'});
   const page=await context.newPage(); const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/kyiv-updates',{waitUntil:'networkidle'});
   await expect(page.getByRole('button',{name:'Збережені · 0',exact:true})).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await page.screenshot({path:`/workspace/work/events-qa/production-${name}.png`});
   await page.getByRole('button',{name:'Вакцинація',exact:true}).click();
   await expect(page.locator('article')).toHaveCount(2);
   await page.getByLabel('Регіон події').selectOption('kyiv_oblast');
   await expect(page.locator('article')).toHaveCount(1);
   await expect(page.getByRole('heading',{name:'Безоплатна вакцина проти сказу на Київщині',exact:true})).toBeVisible();
   await page.getByRole('button',{name:'Зберегти: Безоплатна вакцина проти сказу на Київщині',exact:true}).click();
   await expect(page.getByRole('button',{name:'Прибрати зі збережених: Безоплатна вакцина проти сказу на Київщині',exact:true})).toHaveAttribute('aria-pressed','true');
   await page.reload({waitUntil:'networkidle'});
   await page.getByRole('button',{name:'Збережені · 1',exact:true}).click();
   await expect(page.locator('article')).toHaveCount(1);
   await expect(page.getByRole('heading',{name:'Безоплатна вакцина проти сказу на Київщині',exact:true})).toBeVisible();
   await page.getByRole('button',{name:'Архів',exact:true}).click();
   await expect(page.locator('article')).toHaveCount(1);
   await expect(page.getByRole('heading',{name:'Виїзні щеплення в Обухівській громаді',exact:true})).toBeVisible();
   await expect(page.getByText('Дата минула',{exact:true})).toBeVisible();
   await expect(page.getByRole('button',{name:'У календар',exact:true})).toHaveCount(0);
   await page.getByRole('checkbox',{name:'Адопція',exact:true}).check();
   await page.getByRole('button',{name:'Мої теми',exact:true}).click();
   await expect(page.locator('article')).toHaveCount(2);
   expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('vetnear:events-preferences:v1')))).toEqual({savedIds:['oblast-rabies-vaccination'],followedCategories:['adoption']});
   await page.screenshot({path:`/workspace/work/events-qa/production-${name}-following.png`,fullPage:true});
   await page.getByRole('button',{name:'Актуальне',exact:true}).click();
   await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='vetnear:events-preferences:v1')throw new DOMException('Full','QuotaExceededError');return original.call(this,k,v);};});
   await page.getByRole('button',{name:'Зберегти: Щеплення від сказу без оплати за вакцину',exact:true}).click();
   await expect(page.locator('p[role=alert]')).toContainText('Не вдалося зберегти');
   await expect(page.getByRole('button',{name:'Зберегти: Щеплення від сказу без оплати за вакцину',exact:true})).toHaveAttribute('aria-pressed','false');
   expect(errors).toEqual([]);
   results.push({name,status:'passed',checks:['hydration','responsive overflow','category + region','save + reload','archive + no invalid calendar','topic following','quota failure','no runtime errors']});
   await context.close();
  }
  fs.writeFileSync('/workspace/work/events-qa/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results));
 } finally {await browser.close();}
})();
