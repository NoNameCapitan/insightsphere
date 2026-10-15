'use strict';
// One listing: paste -> one model call -> confirm five groups -> decision card.
let listingSelected=null, listingSignature='', listingPreferred={provider:'',model:''}, listingModels=[];
const actionNames={apply:'Відгукнутися',skip:'Пропустити',clarify:'Уточнити'};
const callNames={running:'Виконується',waiting_manual:'Чекає відповіді з ChatGPT',completed:'Прийнято: формат і цитати',failed:'Не прийнято',cancelled:'Зупинено',interrupted:'Перервано перезапуском',stale:'Неактуально: текст змінився'};
const stageNames={new:'Нові',work:'У роботі',done:'Готові'};
const groupNames={budget:'Бюджет і хто його вказав',deadline:'Строк і часовий пояс',status:'Статус прийому заявок',requirements:"Обов'язкові вимоги",fit:'Відповідність профілю (судження)'};

async function refreshListings(){
  const data=await api('/api/listings');
  listingPreferred=data.preferred;
  for(const stage of ['new','work','done']){
    const box=$('#listings-'+stage); box.replaceChildren();
    const rows=data.listings.filter(l=>l.stage===stage);
    $('#count-'+stage).textContent=rows.length;
    if(!rows.length){const p=document.createElement('p');p.className='muted';p.textContent='Порожньо';box.append(p);}
    for(const l of rows){
      const b=document.createElement('button');
      b.className='task-link'+(listingSelected===l.id?' selected':'');
      b.innerHTML=`${escapeHTML(l.title)}…<small>${escapeHTML(new URL(l.url).hostname)} · ${new Date(l.updated_at).toLocaleDateString('uk-UA')}${l.decision?' · '+escapeHTML(actionNames[l.decision]):''}</small>`;
      b.onclick=()=>action(()=>showListing(l.id));
      box.append(b);
    }
  }
}

function field(label,html){return `<label>${escapeHTML(label)}${html}</label>`;}
function opt(values,current){return Object.entries(values).map(([v,t])=>`<option value="${v}"${v===current?' selected':''}>${escapeHTML(t)}</option>`).join('');}
function groupForm(group,c){
  const value=(c.listing.confirmed[group]||{}).value||c.proposals[group]||{};
  const fields=c.analysis?.fields||{};
  const evidence={budget:fields.budget,deadline:fields.deadline,status:fields.status,requirements:fields.requirements}[group];
  let inputs='';
  if(group==='budget')inputs=field('Сума',`<input name="text" maxlength="400" value="${escapeHTML(value.text||'')}">`)+field('Хто вказав',`<select name="basis">${opt({client:'Замовник',bid:'Ставка/відгук виконавця',unknown:'Невідомо'},value.basis||'unknown')}</select>`)+field('Підстава',`<input name="evidence" maxlength="500" value="${escapeHTML(value.evidence||'')}">`);
  if(group==='deadline')inputs=field('Дата',`<input type="date" name="date" value="${escapeHTML(value.date||'')}">`)+field('Як вказано',`<input name="display" maxlength="300" value="${escapeHTML(value.display||'')}">`)+field('Часовий пояс',`<input name="timezone" maxlength="60" placeholder="напр. Europe/Kyiv" value="${escapeHTML(value.timezone||'')}">`);
  if(group==='status')inputs=field('Статус',`<select name="value">${opt({open:'Відкритий',closed:'Закритий',unknown:'Невідомо'},value.value||'unknown')}</select>`)+field('Підстава',`<input name="evidence" maxlength="500" value="${escapeHTML(value.evidence||'')}">`);
  if(group==='requirements')inputs=field('Відповідність',`<select name="match">${opt({match:'Відповідаю',needs_confirmation:'Треба уточнити',mismatch:'Не відповідаю'},value.match||'needs_confirmation')}</select>`)+field('Допуск до відгуку',`<select name="eligibility">${opt({confirmed:'Підтверджено',unknown:'Невідомо',ineligible:'Не можу відгукнутися'},value.eligibility||'unknown')}</select>`)+field('Вимоги',`<textarea name="text" maxlength="1200">${escapeHTML(value.text||'')}</textarea>`);
  if(group==='fit')inputs=['fit','scope','portfolio'].map(k=>field({fit:'Навички',scope:'Обсяг',portfolio:'Портфоліо'}[k]+' 0-5',`<input type="number" name="${k}" min="0" max="5" step="0.5" value="${escapeHTML(value[k]??0)}">`)).join('')+field('Пояснення',`<textarea name="reason" maxlength="1200">${escapeHTML(value.reason||'')}</textarea>`);
  const confirmed=c.listing.confirmed[group];
  const status=confirmed?`<span class="badge">${confirmed.corrected?'Виправлено власником':'Підтверджено'}</span>`:'<span class="badge warn">Не підтверджено</span>';
  const quote=evidence?.quote?`<blockquote>${escapeHTML(evidence.quote)}<small>цитата моделі</small></blockquote>`:'';
  const problem=evidence&&!evidence.evidence_ok?`<p class="error">${escapeHTML(evidence.problem)}</p>`:'';
  return `<form class="confirm-group" data-group="${group}"><div class="task-meta"><strong>${escapeHTML(groupNames[group])}</strong>${status}</div>${quote}${problem}<div class="group-inputs">${inputs}</div><button class="small-button">Підтвердити</button></form>`;
}
function readGroup(form){
  const out={};
  for(const el of form.querySelectorAll('input,select,textarea'))out[el.name]=el.type==='number'?Number(el.value):el.value;
  return out;
}

function callsHTML(c){
  const hasFix=c.calls.some(x=>x.kind==='format_fix');
  return c.calls.map(run=>{
    let h=`<div class="agent-result"><div class="task-meta"><strong>${run.kind==='format_fix'?'Виправлення формату':'Аналіз'}</strong><span>${escapeHTML(run.provider)}${run.model?' · '+escapeHTML(run.model):''}</span><span class="badge ${run.status==='completed'?'':'warn'}">${escapeHTML(callNames[run.status]||run.status)}</span>${run.elapsed_seconds!=null?`<span>${escapeHTML(run.elapsed_seconds)} с</span>`:''}<span>${run.api_cost_usd===0?'API: $0':'Витрати: невідомо'}</span></div>`;
    if(run.error)h+=`<p class="error">${escapeHTML(run.error)}</p>`;
    if(run.status==='waiting_manual')h+=`<div class="actions"><button class="small-button" data-copy-prompt="${run.id}">Скопіювати запит</button><a href="/api/agents/${run.id}/prompt">Завантажити запит ↓</a></div><form data-paste-run="${run.id}"><label>Вставте повну відповідь JSON (з run_id)<textarea name="reply" required maxlength="2000000"></textarea></label><button class="small-button">Прийняти відповідь</button></form>`;
    if(['running','waiting_manual'].includes(run.status))h+=`<button class="small-button" data-cancel-run="${run.id}">Зупинити</button>`;
    if(run.status==='failed'&&run.provider!=='chatgpt'&&run.kind==='main'&&!hasFix&&/Формат|JSON|по схеме/.test(run.error||''))h+=`<button class="small-button" data-fix-run="${run.id}">Виправити формат (ще один виклик)</button>`;
    return h+'</div>';
  }).join('');
}

async function showListing(id){
  listingSelected=id;
  const c=await api('/api/listings/'+id);
  listingSignature=JSON.stringify([c.calls,c.listing.updated_at]);
  await refreshListings();
  const l=c.listing, v=c.verdict, a=c.analysis;
  const vclass={ready:v.action==='apply'?'go':'',blocked:'no',stale:'warn',confirm:'warn',pending:'warn'}[v.state];
  const running=c.calls.some(x=>['running','waiting_manual'].includes(x.status));
  const provider=listingPreferred.provider||'chatgpt';
  let h=`<div class="task-meta"><span class="badge">${escapeHTML(stageNames[c.stage])}</span><span>Версія тексту ${l.version}</span><span>Імпортовано ${new Date(l.imported_at).toLocaleString('uk-UA')}</span><span class="${c.context_bytes>c.context_limit?'error':''}">Запит ${c.context_bytes}/${c.context_limit} байт</span><span>Виклики ${c.calls_used}/${c.calls_limit}</span></div>`;
  h+=`<h2><a href="${escapeHTML(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(a?.fields.title.evidence_ok?a.fields.title.value:l.url)} ↗</a></h2>`;
  h+=`<section class="verdict ${vclass}"><div class="section-label">РІШЕННЯ</div><h3>${escapeHTML(v.title)}</h3>${v.reasons.length?'<ul>'+v.reasons.map(r=>'<li>'+escapeHTML(r)+'</li>').join('')+'</ul>':''}<p class="muted">Підтверджено груп ${c.confirmation.confirmed}/${c.confirmation.total} · першоджерело ${c.confirmation.source_checked?'відкрито власником':'<b>не перевірено</b>'} · бюджет замовника: ${escapeHTML(c.budget_display)} · відповідність ${c.score}/100 (${c.score_source==='owner'?'оцінка власника':c.score_source==='model'?'судження моделі':'немає'})</p></section>`;
  if(a)h+=`<section class="panel-lite"><div class="task-meta"><strong>Чернетка відгуку</strong>${c.draft_current?'':'<span class="badge warn">Неактуальна</span>'}</div><textarea id="draft-reply" readonly>${escapeHTML(c.draft_reply)}</textarea><div class="actions"><button class="small-button" id="copy-draft">Скопіювати чернетку</button><a href="/api/listings/${id}/card.md">Картка рішення ↓</a></div>${a.recommendation.unknowns.length?'<p><strong>Невідомо:</strong> '+a.recommendation.unknowns.map(escapeHTML).join(' · ')+'</p>':''}<p class="muted">${a.limitations.map(escapeHTML).join(' · ')}</p></section>`;
  if(c.info.length)h+=`<details><summary>Довідкові зауваження правил · ${c.info.length}</summary><ul>${c.info.map(i=>'<li>'+escapeHTML(i)+'</li>').join('')}</ul></details>`;
  h+=`<section class="panel-lite"><div class="section-label">ПЕРШОДЖЕРЕЛО</div>${l.source_checked_at?`<p>Відкрито й перевірено власником ${new Date(l.source_checked_at).toLocaleString('uk-UA')}.</p>`:'<p class="muted">Вставлений текст ще не звірено з живою сторінкою.</p><button class="small-button" id="source-checked">Я відкрив першоджерело й звірив</button>'}</section>`;
  h+=`<section class="agents-panel"><h3>Аналіз моделлю</h3><div class="agent-controls"><label>Виконавець<select id="listing-provider">${opt({ollama:'Ollama · локально',claude_code:'Claude Code · ліміти підписки',chatgpt:'ChatGPT · вручну'},provider)}</select></label><label>Модель Ollama<input id="listing-model" maxlength="200" value="${escapeHTML(listingPreferred.model||'')}" list="listing-models" placeholder="Оберіть встановлену модель"><datalist id="listing-models">${listingModels.map(m=>`<option value="${escapeHTML(m)}"></option>`).join('')}</datalist></label></div><div class="actions"><button class="secondary" id="listing-analyze"${running||c.calls_used>=c.calls_limit?' disabled':''}>${a?'Повторити аналіз':'Аналізувати'}</button><button class="small-button" id="find-models">Знайти локальні моделі</button></div><p class="muted">Найменша модель автоматично не обирається. Для Ollama один автоматичний повтор при помилці формату. Таймаут не повторюється.</p>${callsHTML(c)}</section>`;
  h+=`<section class="panel-lite"><div class="section-label">ПІДТВЕРДЖЕННЯ · 5 ГРУП</div><p class="muted">Факти стають фактами лише після вашого підтвердження. Виправлення записуються в журнал.</p>${['budget','deadline','status','requirements','fit'].map(g=>groupForm(g,c)).join('')}</section>`;
  const d=l.decision, o=l.outcome;
  h+=`<section class="panel-lite"><div class="section-label">ВАШЕ РІШЕННЯ</div><form id="decide-form" class="group-inputs">${field('Рішення',`<select name="action">${opt(actionNames,d.action||v.action||'clarify')}</select>`)}${field('Активних хвилин',`<input type="number" name="active_minutes" min="0" max="1440" step="1" value="${escapeHTML(d.active_minutes??'')}">`)}${field('Хвилин поза програмою',`<input type="number" name="outside_minutes" min="0" max="1440" step="1" value="${escapeHTML(d.outside_minutes??'')}">`)}${field('Нотатка',`<input name="note" maxlength="2000" value="${escapeHTML(d.note||'')}">`)}<button class="small-button">Записати рішення</button></form>${d.at?`<p class="muted">Записано ${new Date(d.at).toLocaleString('uk-UA')}</p>`:''}</section>`;
  const tri=(k)=>`<select name="${k}">${opt({'':'Невідомо','true':'Так','false':'Ні'},o[k]==null?'':String(o[k]))}</select>`;
  h+=`<section class="panel-lite"><div class="section-label">РЕЗУЛЬТАТ</div><form id="outcome-form" class="group-inputs">${field('Відгук надіслано',tri('applied'))}${field('Є відповідь',tri('replied'))}${field('Замовлення отримано',tri('won'))}${field('Годин роботи',`<input type="number" name="hours" min="0" step="0.5" value="${escapeHTML(o.hours??'')}">`)}${field('Дохід',`<input type="number" name="income" min="0" step="1" value="${escapeHTML(o.income??'')}">`)}${field('Валюта',`<input name="currency" maxlength="10" value="${escapeHTML(o.currency||'')}">`)}<button class="small-button">Зберегти результат</button></form></section>`;
  h+=`<details><summary>Оновити текст оголошення</summary><form id="text-form"><textarea name="text" maxlength="20000">${escapeHTML(l.text)}</textarea><p class="muted">Новий текст = нова версія: підтвердження й перевірку першоджерела треба повторити. Той самий текст нічого не змінює.</p><button class="small-button">Зберегти текст</button></form></details>`;
  $('#listing-detail').innerHTML=h;
  bindListing(id,c);
}

function bindListing(id,c){
  const version=c.listing.version, reload=async(text)=>{await showListing(id);if(text)message(text);};
  $('#copy-draft')?.addEventListener('click',()=>action(async()=>{try{await navigator.clipboard.writeText($('#draft-reply').value);message('Чернетку скопійовано. Надсилаєте ви самі.');}catch(_){$('#draft-reply').select();message('Буфер недоступний: текст виділено, скопіюйте вручну.');}}));
  $('#source-checked')?.addEventListener('click',()=>action(async()=>{await api(`/api/listings/${id}/source-checked`,{version});await reload('Позначено: першоджерело перевірено.');}));
  $('#listing-analyze').onclick=()=>action(async()=>{const run=await api(`/api/listings/${id}/analyze`,{provider:$('#listing-provider').value,model:$('#listing-model').value});await reload(run.status==='waiting_manual'?'Запит готовий: скопіюйте його в ChatGPT і вставте відповідь.':'Аналіз запущено.');});
  $('#find-models').onclick=()=>action(async()=>{const inv=await api('/api/providers');listingModels=(inv.providers.find(p=>p.id==='ollama')?.models||[]).map(m=>m.name);await reload(listingModels.length?'Знайдено моделей: '+listingModels.length+'. Оберіть ту, що підходить вашій пам\'яті.':'Локальних моделей не знайдено.');});
  document.querySelectorAll('#listing-detail [data-copy-prompt]').forEach(b=>b.onclick=()=>action(async()=>{const r=await fetch('/api/agents/'+b.dataset.copyPrompt+'/prompt');if(!r.ok)throw new Error('Не вдалося отримати запит');const t=await r.text();try{await navigator.clipboard.writeText(t);message('Запит скопійовано.');}catch(_){message('Буфер недоступний. Скористайтеся «Завантажити запит».');}}));
  document.querySelectorAll('#listing-detail [data-paste-run]').forEach(f=>f.onsubmit=e=>{e.preventDefault();action(async()=>{let raw=new FormData(f).get('reply').trim();const block=raw.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);if(block)raw=block[1];let data;try{data=JSON.parse(raw);}catch(_){throw new Error('Це не JSON. Вставлений текст збережено в полі.');}await api('/api/agents/'+f.dataset.pasteRun+'/import',data);await reload('Відповідь прийнято. Підтвердіть поля.');});});
  document.querySelectorAll('#listing-detail [data-cancel-run]').forEach(b=>b.onclick=()=>action(async()=>{await api('/api/agents/'+b.dataset.cancelRun+'/cancel',{});await reload('Виклик зупинено.');}));
  document.querySelectorAll('#listing-detail [data-fix-run]').forEach(b=>b.onclick=()=>action(async()=>{await api(`/api/listings/${id}/fix`,{run_id:b.dataset.fixRun});await reload('Запущено виправлення формату.');}));
  document.querySelectorAll('#listing-detail .confirm-group').forEach(f=>f.onsubmit=e=>{e.preventDefault();action(async()=>{await api(`/api/listings/${id}/confirm`,{group:f.dataset.group,value:readGroup(f),version});await reload('Підтверджено: '+groupNames[f.dataset.group]+'.');});});
  $('#decide-form').onsubmit=e=>{e.preventDefault();action(async()=>{const v=readGroup(e.target);const n=x=>x===''?null:Number(x);await api(`/api/listings/${id}/decide`,{action:v.action,active_minutes:n(e.target.active_minutes.value),outside_minutes:n(e.target.outside_minutes.value),note:v.note});await reload('Рішення записано.');});};
  $('#outcome-form').onsubmit=e=>{e.preventDefault();action(async()=>{const f=e.target,b=x=>x===''?null:x==='true',n=x=>x===''?null:Number(x);await api(`/api/listings/${id}/outcome`,{outcome:{applied:b(f.applied.value),replied:b(f.replied.value),won:b(f.won.value),hours:n(f.hours.value),income:n(f.income.value),currency:f.currency.value}});await reload('Результат збережено.');});};
  $('#text-form').onsubmit=e=>{e.preventDefault();action(async()=>{const r=await api(`/api/listings/${id}/text`,{text:new FormData(e.target).get('text')});await reload(r.unchanged?'Текст не змінився; свіжість не оновлено.':'Збережено нову версію тексту.');});};
}

$('#listing-form').onsubmit=e=>{e.preventDefault();action(async()=>{
  // Inputs are cleared only after the server has stored the listing.
  const l=await api('/api/listings',{url:$('#listing-url').value.trim(),text:$('#listing-text').value});
  $('#listing-url').value='';$('#listing-text').value='';
  await showListing(l.id);
  message(l.existing?(l.unchanged?'Це оголошення вже є; текст не змінився.':'Оголошення вже було: збережено нову версію тексту.'):'Оголошення збережено. Запустіть аналіз.');
});};
setInterval(async()=>{
  if(busy||!listingSelected||$('#listings-view').hidden)return;
  const id=listingSelected;
  try{const c=await api('/api/listings/'+id);if(listingSelected===id&&JSON.stringify([c.calls,c.listing.updated_at])!==listingSignature&&!document.activeElement?.closest('#listing-detail form'))await showListing(id);}catch(_){/* keep last state */}
},2000);
