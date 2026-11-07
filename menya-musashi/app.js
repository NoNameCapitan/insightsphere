'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const venues = window.MUSASHI.venues;
let venue = venues.find(v => v.key === '19') || venues[0], section = 0, category = '0', query = '', favoritesOnly = false, lastFocus;
let saved = new Set();
try { const parsed = JSON.parse(localStorage.getItem('musashi-saved') || '[]'); if(Array.isArray(parsed)) saved = new Set(parsed.filter(s => typeof s === 'string').slice(0,1000)); } catch {}
const heart = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M20.3 4.7a5.4 5.4 0 0 0-7.6 0L12 5.4l-.7-.7a5.4 5.4 0 0 0-7.6 7.6L12 20.6l8.3-8.3a5.4 5.4 0 0 0 0-7.6Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>';
$('#favorites-toggle').innerHTML = heart + ' Обране <b id="favorites-count">0</b>';
const sectionName = t => t.startsWith('ОСНОВНЕ') ? 'Кухня' : t.startsWith('БАР Б/А') ? 'Без алкоголю' : t.startsWith('БАР BY') ? 'Бар Torisho' : t.startsWith('БАР') ? 'Бар' : t.includes('ЛАНЧ XL') ? 'Ланч XL' : t.includes('ЛАНЧ L') ? 'Ланч L' : t.includes('ДИТЯЧ') ? 'Для дітей' : t.includes('МАГАЗИН') ? 'Японський чай' : t.includes('PET') ? 'Для улюбленців' : t.includes('ЛІТНЄ') ? 'Сезонне' : t.includes('ВЕЧЕРЯ') ? 'Вечеря' : t.includes('CHALLENGE') ? 'Ramen Challenge' : t;
function itemCount(n) { const d=n%10,h=n%100; return `${n} ${d===1&&h!==11?'позиція':d>=2&&d<=4&&(h<12||h>14)?'позиції':'позицій'}`; }
function sectionIndex() { return venue.sections.findIndex(s => s.title.startsWith('ОСНОВНЕ')); }
function officialUrl(item) { return item?.url ? venue.url+'/'+item.url : venue.url; }
function saveKey(item) { return venue.key + '|' + (item.url || item.name); }
function rows() { return venue.sections.flatMap((s,si) => s.categories.flatMap((c,ci) => c.items.map((item,ii) => ({item,si,ci,ii,sectionTitle:s.title,categoryTitle:c.title})))); }
function saveButton(item,extra='') { const key=saveKey(item),active=saved.has(key);return `<button type="button" class="save-dish ${extra}" data-save="${esc(key)}" aria-label="${esc((active?'Прибрати з обраного: ':'Зберегти: ')+item.name)}" aria-pressed="${active}" title="${active?'Прибрати з обраного':'Зберегти страву'}">${heart}</button>`; }
function updateSavedUI() {
  const count = new Set(rows().filter(r=>saved.has(saveKey(r.item))).map(r=>saveKey(r.item))).size;
  $('#favorites-count').textContent = count;
  $('#favorites-toggle').setAttribute('aria-pressed',String(favoritesOnly));
}
function toggleSaved(button) {
  const key=button.dataset.save, exists=saved.has(key);
  if(exists) saved.delete(key); else saved.add(key);
  try { localStorage.setItem('musashi-saved',JSON.stringify([...saved])); } catch {}
  for(const b of document.querySelectorAll('[data-save]')) {
    if(b.dataset.save!==key)continue;
    b.setAttribute('aria-pressed',String(!exists));
    const name=b.getAttribute('aria-label').replace(/^(Зберегти: |Прибрати з обраного: )/,'');
    b.setAttribute('aria-label',(exists?'Зберегти: ':'Прибрати з обраного: ')+name);
    b.title=exists?'Зберегти страву':'Прибрати з обраного';
  }
  updateSavedUI();
  const status=$('#save-status');status.textContent=exists?'Страву прибрано з обраного':'Страву збережено в обраному';status.classList.add('visible');
  clearTimeout(toggleSaved.timer);toggleSaved.timer=setTimeout(()=>status.classList.remove('visible'),2200);
  if(favoritesOnly){renderCatalog();if(!$('#dish-dialog').open)$('#favorites-toggle').focus({preventScroll:true});}
}
const venueOptions = venues.map(v=>`<option value="${esc(v.key)}">${esc(v.name)}</option>`).join('');
for(const select of document.querySelectorAll('[data-venue-picker]')){select.innerHTML=venueOptions;select.addEventListener('change',e=>updateVenue(e.target.value));}
function updateVenue(key) {
  venue=venues.find(v=>v.key===key)||venues[0];
  try{localStorage.setItem('musashi-venue',venue.key);}catch{}
  for(const select of document.querySelectorAll('[data-venue-picker]'))select.value=venue.key;
  section=Math.max(0,sectionIndex());category='0';query='';favoritesOnly=false;$('#search').value='';
  document.querySelectorAll('.official').forEach(a=>a.href=venue.url);
  $('#venue-note').textContent=`${venue.hours} щодня · Ціни й асортимент цього закладу`;
  const aburi=rows().find(r=>r.item.name==='Рамен з куркою Абурі');
  if(aburi)$('#hero-price').textContent=aburi.item.price;
  renderTabs();renderCategories();renderCatalog();updateSavedUI();
  document.dispatchEvent(new CustomEvent('musashi:venue'));
}
function renderTabs() {
  $('#section-tabs').innerHTML=venue.sections.map((s,i)=>`<button role="tab" aria-selected="${i===section}" tabindex="${i===section?0:-1}" data-section="${i}" title="${esc(s.title)}">${esc(sectionName(s.title))}</button>`).join('');
}
function renderCategories() {
  const s=venue.sections[section];
  $('#categories').innerHTML=`<button class="${category==='all'?'active':''}" data-category="all">Усі</button>`+s.categories.map((c,i)=>`<button class="${category===String(i)?'active':''}" data-category="${i}">${esc(c.title.trim()||'Сезонні пропозиції')}</button>`).join('');
  $('#categories').hidden=!s.categories.length||favoritesOnly||!!query.trim();
}
function hiRes(item) { return (window.MUSASHI_HIRES&&window.MUSASHI_HIRES[item.name])||item.image; }
function meta(item) {return item.measure||item.labels.filter(t=>!/^\d/.test(t)).join(' · ');}
function card(item,ci,ii,si=section) {
  return `<article class="menu-tile"><button class="dish-card" data-item="${si}:${ci}:${ii}" aria-label="${esc(item.name+' — '+(item.price||'у складі ланчу'))}"><span class="dish-photo ${item.image?'':'no-photo'}">${item.image?`<img src="${esc(hiRes(item))}" alt="${esc(item.name)}" loading="lazy" decoding="async" width="400" height="300">`:`<span>${esc(venue.sections[si].categories[ci].title)}</span>`}<span class="dish-arrow" aria-hidden="true">+</span></span><span class="dish-info"><span class="dish-heading"><h3>${esc(item.name)}</h3><strong>${esc(item.price||'У ланчі')}</strong></span>${item.description?`<span class="dish-description">${esc(item.description)}</span>`:''}${meta(item)?`<span class="dish-meta">${esc(meta(item))}</span>`:''}</span></button>${saveButton(item)}</article>`;
}
function renderCatalog() {
  const q=query.trim().toLocaleLowerCase('uk');let html='',count=0;
  const everySection=!!q||favoritesOnly;
  const visibleSections=everySection?venue.sections.map((s,si)=>({s,si})):[{s:venue.sections[section],si:section}];
  for(const {s,si} of visibleSections){let part='',partCount=0;
    s.categories.forEach((c,ci)=>{
      if(!everySection&&category!=='all'&&category!==String(ci))return;
      const items=c.items.map((item,ii)=>({item,ii})).filter(({item})=>(!favoritesOnly||saved.has(saveKey(item)))&&(!q||[item.name,item.description,c.title].join(' ').toLocaleLowerCase('uk').includes(q)));
      if(!items.length)return;partCount+=items.length;
      if(category==='all'||everySection)part+=`<h3 class="category-label">${esc(everySection?sectionName(s.title)+' / ':'')}${esc(c.title.trim()||'Сезонні пропозиції')}</h3>`;
      if(c.description&&!everySection)part+=`<details class="category-description"><summary>Про цей розділ</summary><p>${esc(c.description)}</p></details>`;
      part+=items.map(({item,ii})=>card(item,ci,ii,si)).join('');
    });
    if(partCount&&s.title.includes('ЛАНЧ'))html+=`<div class="lunch-info"><strong>${s.title.includes('XL')?'Ланч XL · 419 ₴':'Ланч L · 349 ₴'}</strong>12:00–16:00 · Обери першу страву, другу страву та напій. Остаточне комплектування уточни в закладі.</div>`;
    html+=part;count+=partCount;
  }
  if(!count)html+=`<div class="empty"><h3>${q?'Нічого не знайшли':favoritesOnly?'Тут будуть твої улюблені страви':'У цьому розділі ще немає опублікованих позицій'}</h3><p>${q?'Спробуй іншу назву або інгредієнт.':favoritesOnly?'Натисни сердечко на страві. Обране зберігається на цьому пристрої окремо для кожного закладу.':'Перевір наявність у закладі або відкрий офіційне меню.'}</p>${favoritesOnly?'<button class="btn outline" id="show-all-dishes">Повернутися до меню</button>':`<a class="btn outline" href="${esc(venue.url)}" target="_blank" rel="noopener">Офіційне меню →</a>`}</div>`;
  $('#catalog').innerHTML=html;
  $('#catalog-note').textContent=`${itemCount(count)} · ${favoritesOnly?'Обране':q?'Усе меню закладу':sectionName(venue.sections[section].title)}`;
  $('#clear-search').hidden=!q;$('#categories').hidden=everySection||!venue.sections[section].categories.length;
  $('#surprise').hidden=!!q||!count||/PET|CHALLENGE/.test(venue.sections[section].title);
  updateSavedUI();document.dispatchEvent(new CustomEvent('musashi:catalog'));
}
function selectSection(si,selectedCategory='all') {
  if(!Number.isInteger(si)||si<0||si>=venue.sections.length)return;
  section=si;category=selectedCategory;query='';favoritesOnly=false;$('#search').value='';renderTabs();renderCategories();renderCatalog();
}
function showDish(si,ci,ii) {
  const s=venue.sections[si],c=s?.categories[ci],item=c?.items[ii];if(!item)return;
  lastFocus=document.activeElement;const opts=item.options||[];
  const options=opts.map(g=>`<details><summary>${esc(g.title)}</summary>${g.items.map(o=>`<div class="variant-row"><span>${esc(o.name)}</span><span>${esc(o.price)}</span></div>`).join('')}</details>`).join('');
  $('#dish-content').innerHTML=`${item.image?`<img class="detail-image" src="${esc(item.largeImage||hiRes(item))}" alt="${esc(item.name)}">`:''}<div class="detail-body"><p class="eyebrow">${esc(c.title)}</p><h2 id="dish-title">${esc(item.name)}</h2><div class="detail-price-row"><strong class="detail-price">${esc(item.price||'У складі ланчу')}</strong>${saveButton(item,'detail-save')}</div>${item.measure?`<p>${esc(item.measure)}</p>`:''}<p>${esc(item.description||'Докладний склад та доступні варіанти дивись у картці офіційного меню.')}</p>${item.labels?.length?`<div class="detail-labels">Позначки меню: ${esc(item.labels.join(' · '))}</div>`:''}${options}${!opts.length&&/^Від/.test(item.price)?'<p>Є варіанти розміру або доповнень. Обери їх в офіційній картці страви.</p>':''}<a class="btn red" href="${esc(officialUrl(item))}" target="_blank" rel="noopener">Відкрити в офіційному меню →</a><p class="detail-note">${esc(venue.name)} · Відкриється сервіс Choice. Демо не приймає оплату та не надсилає замовлення.</p></div>`;
  $('#dish-content').style.gridTemplateColumns=item.image?'':'1fr';$('#dish-dialog').showModal();document.body.style.overflow='hidden';
}
$('#section-tabs').addEventListener('click',e=>{const b=e.target.closest('[data-section]');if(b)selectSection(+b.dataset.section,'0');});
$('#section-tabs').addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const si=e.key==='Home'?0:e.key==='End'?venue.sections.length-1:(section+(e.key==='ArrowRight'?1:-1)+venue.sections.length)%venue.sections.length;selectSection(si,'0');$('#section-tabs [aria-selected=true]').focus();});
$('#categories').addEventListener('click',e=>{const b=e.target.closest('[data-category]');if(b){category=b.dataset.category;renderCategories();renderCatalog();}});
$('#search').addEventListener('input',e=>{query=e.target.value;renderCatalog();});
$('#clear-search').addEventListener('click',()=>{query='';$('#search').value='';renderCategories();renderCatalog();$('#search').focus();});
$('#favorites-toggle').addEventListener('click',()=>{favoritesOnly=!favoritesOnly;renderCategories();renderCatalog();});
$('#catalog').addEventListener('click',e=>{
  const save=e.target.closest('[data-save]');if(save){toggleSaved(save);return;}
  if(e.target.closest('#show-all-dishes')){favoritesOnly=false;query='';$('#search').value='';renderCategories();renderCatalog();return;}
  const b=e.target.closest('[data-item]');if(b)showDish(...b.dataset.item.split(':').map(Number));
});
$('#dish-content').addEventListener('click',e=>{const save=e.target.closest('[data-save]');if(save)toggleSaved(save);});
$('#surprise').addEventListener('click',()=>{const candidates=[...$('#catalog').querySelectorAll('[data-item]')];if(candidates.length)showDish(...candidates[Math.floor(Math.random()*candidates.length)].dataset.item.split(':').map(Number));});
$('.close').addEventListener('click',()=>$('#dish-dialog').close());
$('#dish-dialog').addEventListener('close',()=>{document.body.style.overflow='';lastFocus?.focus({preventScroll:true});});
$('#dish-dialog').addEventListener('click',e=>{if(e.target===$('#dish-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
$('#location-list').innerHTML=venues.map((v,i)=>`<article class="location-row"><span class="location-number">${String(i+1).padStart(2,'0')}</span><div><h3>${esc(v.name)}</h3><p>${esc(v.subtitle||'Menya Musashi · Київ')}</p>${v.phone?`<a class="phone" href="${esc(v.phoneHref)}">${esc(v.phone)}</a>`:''}</div><div class="location-hours">${esc(v.hours)}<p>Щодня</p></div><div class="location-actions"><button data-venue="${esc(v.key)}">Меню закладу</button><a href="${esc(v.map)}" target="_blank" rel="noopener">На карті →</a></div></article>`).join('');
$('#location-list').addEventListener('click',e=>{const b=e.target.closest('[data-venue]');if(b){updateVenue(b.dataset.venue);$('#menu').scrollIntoView({behavior:document.body.classList.contains('no-motion')?'instant':'smooth'});}});
const motionPreference=matchMedia('(prefers-reduced-motion: reduce)');let motionOff=false;
try{motionOff=localStorage.getItem('musashi-motion')==='off';}catch{}
function setMotion(){const off=motionOff||motionPreference.matches;document.body.classList.toggle('no-motion',off);$('#motion').setAttribute('aria-pressed',String(off));$('#motion').disabled=motionPreference.matches;$('#motion').title=motionPreference.matches?'Системне налаштування зменшення руху':'Увімкнути або вимкнути анімацію';$('#motion').innerHTML=off?'Рух вимкнено <span>○</span>':'Рух увімкнено <span>◉</span>';document.dispatchEvent(new CustomEvent('musashi:motion'));}
$('#motion').addEventListener('click',()=>{motionOff=!motionOff;setMotion();try{localStorage.setItem('musashi-motion',motionOff?'off':'on');}catch{}});setMotion();motionPreference.addEventListener('change',setMotion);
let rememberedVenue=venue.key;try{rememberedVenue=localStorage.getItem('musashi-venue')||venue.key;}catch{}
updateVenue(rememberedVenue);
window.MusashiUI={selectSection,getVenue:()=>venue,openDish:showDish,rows,randomFood:()=>{const candidates=rows().filter(r=>r.sectionTitle.startsWith('ОСНОВНЕ')&&r.item.image&&!/ДОДАТ|СОУС/.test(r.categoryTitle));const row=candidates[Math.floor(Math.random()*candidates.length)];if(row)showDish(row.si,row.ci,row.ii);}};
