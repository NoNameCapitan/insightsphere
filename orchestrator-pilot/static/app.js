'use strict';
const token = document.querySelector('meta[name="app-token"]').content;
let state, selected, busy = false, inventory, importingRun, runsSignature='';
const $ = s => document.querySelector(s);
const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statuses = {ready:'Готово к обработке',awaiting_evidence:'Ожидает материалы',completed:'Отчёт создан',budget_exhausted:'Достигнут лимит шагов',cancelled:'Остановлено'};
const decisions = {candidate:'Кандидат',needs_review:'Нужно уточнить',excluded:'Исключён'};
async function api(path, body) {
  const response = await fetch(path, body === undefined ? {headers:{'X-Orchestrator-Token':token}} : {method:'POST',headers:{'Content-Type':'application/json','X-Orchestrator-Token':token},body:JSON.stringify(body)});
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Не удалось выполнить действие');
  return data;
}
function message(text, error = false) { $('#message').textContent=text; $('#message').className=error?'error':''; }
async function action(fn) {
  if(busy)return;
  busy=true; document.querySelectorAll('button:not(:disabled)').forEach(b=>{b.disabled=true;b.dataset.busyDisabled='true';});
  try { await fn(); } catch(error) { message(error.message, true); }
  finally { busy=false; document.querySelectorAll('button[data-busy-disabled]').forEach(b=>{b.disabled=false;delete b.dataset.busyDisabled;}); }
}
function setView(view) {
  ['tasks','context','tools','quality','workloop','outcomes'].forEach(v=>{$('#'+v+'-view').hidden=v!==view;document.querySelector(`[data-view="${v}"]`).classList.toggle('active',v===view);});
}
async function refresh() {
  state=await api('/api/state'); $('#version').textContent=state.version;
  const list=$('#task-list'); list.replaceChildren();
  if(!state.tasks.length){const p=document.createElement('p');p.className='muted';p.textContent='Задач пока нет';list.append(p);}
  for(const task of state.tasks){const b=document.createElement('button');b.className='task-link'+(selected===task.id?' selected':'');b.innerHTML=`${escapeHTML(task.objective)}<small>${escapeHTML(statuses[task.status])} · ${new Date(task.created_at).toLocaleDateString('ru-RU')}</small>`;b.addEventListener('click',()=>action(()=>showTask(task.id)));list.append(b);}
  const p=state.profile;
  $('#profile-fields').innerHTML=[['Направления',p.directions],['Приоритеты',p.priorities],['Интерфейсы',p.interfaces],['Режимы исполнения',p.execution_modes||[]]].map(([k,v])=>`<div class="profile-block"><strong>${escapeHTML(k)}</strong><div class="chips">${v.map(t=>`<span class="chip">${escapeHTML(t)}</span>`).join('')}</div></div>`).join('');
  if(document.activeElement!==$('#notes'))$('#notes').value=p.notes||'';
  $('#tool-list').innerHTML=state.capabilities.map(t=>`<div class="tool-row"><strong>${escapeHTML(t.name)}</strong> <span class="badge ${t.local==='available'?'':'warn'}">${t.local==='available'?'Доступно':'Не подключено локально'}</span><p>${escapeHTML(t.note)}</p></div>`).join('');
}
async function showTask(id){
  selected=id; const task=await api('/api/tasks/'+id); await refresh(); setView('tasks');
  const done=['completed','cancelled','budget_exhausted'].includes(task.status);
  const steps=['План','Материалы','Оценка','Отчёт'];
  let html=`<div class="task-meta"><span class="badge">${escapeHTML(statuses[task.status])}</span><span>Шаги: ${task.steps_used}/${task.max_steps}</span><span>Материалы: ${task.items.length}</span></div><h2>${escapeHTML(task.objective)}</h2><div class="steps">${steps.map((s,i)=>`<div class="step ${task.cursor>i?'done':''}">${i+1}. ${s}</div>`).join('')}</div>`;
  if(task.status==='awaiting_evidence') html+='<div class="notice">План сохранён. Веб-поиск выполняется в ChatGPT; здесь можно импортировать пакет найденных материалов. Пробная подборка доступна кнопкой выше.</div>';
  html+='<div class="actions">';
  if(!done)html+='<button class="small-button" id="import-button">Импортировать материалы</button><button class="small-button" id="run-button">Продолжить обработку</button><button class="small-button" id="cancel-button">Остановить</button>';
  if(task.report)html+=`<a href="/api/tasks/${id}/report">Скачать отчёт ↓</a>`;
  html+='<a href="/api/materials-template">Шаблон материалов</a></div>';
  if(task.items.length && !['cancelled','budget_exhausted'].includes(task.status)){
    html+=`<section class="agents-panel"><h3>Подключить исполнителя</h3><p class="muted">Автовыбор использует установленную локальную модель или готовит запрос для ChatGPT. Claude запускается при явном выборе.</p><div class="agent-controls"><label>Роль<select id="agent-role"><option value="team">Аналитик → проверяющий</option><option value="analyst">Аналитик</option><option value="reviewer">Проверяющий</option></select></label><label>Исполнитель<select id="agent-provider"><option value="auto">Автовыбор · локально / ChatGPT</option><option value="ollama">Ollama · локальная модель</option><option value="claude_code">Claude Code · лимиты подписки</option><option value="chatgpt">ChatGPT · по запросу</option></select></label><label>Модель Ollama<input id="agent-model" maxlength="200" placeholder="Автовыбор из установленных" list="local-models"><datalist id="local-models">${(inventory?.providers.find(p=>p.id==='ollama')?.models||[]).map(m=>`<option value="${escapeHTML(m.name)}"></option>`).join('')}</datalist></label></div><p id="provider-note" class="muted">Модель анализирует сохранённые материалы; живой веб-поиск здесь не выполняется.</p><button id="agent-start" class="secondary">Запустить роль</button><span class="agent-count">Запуски: ${task.agent_runs.length}/4</span></section>`;
  }
  html+='<div id="agent-results"></div>';
  if(task.analysis.length)html+='<div class="notice">Ниже — сведения из импортированных источников. Ядро проверило структуру и правила. Балл отражает оценку соответствия, а не вероятность заработка.</div>';
  for(const item of task.analysis){
    const badge=item.decision==='candidate'?'':item.decision==='excluded'?'no':'warn';
    html+=`<article class="opportunity"><span class="badge ${badge}">${escapeHTML(decisions[item.decision])}</span><span class="score">${item.score===undefined?'Оценка ещё не рассчитана':item.score+'/100 · соответствие'}${item.seen_before?' · уже встречалось':''}</span><h3><a href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(item.title)} ↗</a></h3><p class="budget">${escapeHTML(item.budget_display)}</p><p>${escapeHTML(item.summary)}</p><p><strong>Почему подходит:</strong> ${escapeHTML(item.fit_reason)}</p><p><strong>Следующий шаг:</strong> ${escapeHTML(item.next_action)}</p><p class="muted">${escapeHTML(item.caution)} ${escapeHTML(item.eligibility_note)}</p><p class="source">Срок: ${escapeHTML(item.deadline_display||'не указан')} · Проверка: ${escapeHTML(item.checked_at||'нет даты')}</p>${item.issues.length?'<ul>'+item.issues.map(s=>'<li>'+escapeHTML(s)+'</li>').join('')+'</ul>':''}</article>`;
  }
  const eventNames={created:'Задача создана',plan_ready:'План сохранён',materials_imported:'Материалы добавлены',structure_checked:'Поля и даты проверены',ranked:'Соответствие рассчитано',report_created:'Отчёт сохранён',limit_reached:'Лимит достигнут',cancelled:'Работа остановлена',agent_started:'Роль запущена',agent_result_saved:'Ответ роли сохранён',agent_failed:'Ответ роли не принят',agent_interrupted:'Вызов прерван',agent_cancelled:'Роль остановлена',reviewer_not_started:'Проверяющий не запущен: проверь лимиты или состояние задачи'};
  html+='<details><summary>Журнал действий · '+task.events.length+'</summary>'+task.events.map(e=>`<div class="event"><small>${new Date(e.at).toLocaleTimeString('ru-RU')}</small><span>${escapeHTML(eventNames[e.action]||e.action)}</span></div>`).join('')+'</details>';
  $('#task-detail').innerHTML=html;
  renderRuns(task.agent_runs);
  if($('#agent-start')){
    $('#agent-provider').onchange=()=>{$('#provider-note').textContent=$('#agent-provider').value==='claude_code'?'Запрос передаст материалы в Claude и использует лимиты вашей подписки. Фактические списания зависят от настроек аккаунта.':'Модель анализирует сохранённые материалы; живой веб-поиск здесь не выполняется.';};
    $('#agent-start').onclick=()=>action(async()=>{const run=await api('/api/tasks/'+id+'/agents',{role:$('#agent-role').value,provider:$('#agent-provider').value,model:$('#agent-model').value});await showTask(id);message(run.status==='waiting_manual'?'Запрос сохранён: скачай его и передай в ChatGPT.':'Агент запущен. Результат появится здесь.');});
  }
  if(!done){$('#import-button').onclick=()=>$('#materials-file').click();$('#run-button').onclick=()=>action(async()=>{await api('/api/tasks/'+id+'/run',{});await showTask(id);message('Состояние задачи сохранено.');});$('#cancel-button').onclick=()=>action(async()=>{await api('/api/tasks/'+id+'/cancel',{});await showTask(id);message('Задача остановлена.');});}
}
const runNames={running:'Выполняется',waiting_manual:'Ожидает ответа из ChatGPT',completed:'Формат и цитаты проверены',failed:'Ответ не принят',cancelled:'Остановлен',interrupted:'Прерван при закрытии приложения',stale:'Материалы изменились · нужно повторить анализ'};
function renderRuns(runs){
  if(!$('#agent-results'))return;
  runsSignature=JSON.stringify(runs);
  $('#agent-results').innerHTML=runs.map(run=>{
    const r=run.result;
    let h=`<article class="agent-result"><div class="task-meta"><strong>${run.role==='analyst'?'Аналитик':'Проверяющий'}</strong><span>${escapeHTML(run.provider)}${run.model?' · '+escapeHTML(run.model):''}</span><span class="badge ${run.status==='completed'?'':'warn'}">${escapeHTML(runNames[run.status]||run.status)}</span></div>`;
    if(run.error)h+=`<p class="error">${escapeHTML(run.error)}</p>`;
    if(run.status==='waiting_manual')h+=`<p>Скопируй запрос в ChatGPT. Ответ можно вставить ниже или загрузить файлом.</p><div class="actions"><button class="small-button" data-copy-prompt="${run.id}">Скопировать запрос</button><a href="/api/agents/${run.id}/prompt">Скачать запрос ↓</a><button class="small-button" data-import-run="${run.id}">Импорт файла</button></div><details><summary>Вставить ответ JSON</summary><form data-paste-run="${run.id}"><label>Полный JSON с run_id<textarea name="reply" required maxlength="2000000"></textarea></label><button class="small-button">Принять ответ</button></form></details>`;
    if(['running','waiting_manual'].includes(run.status))h+=`<button class="small-button" data-cancel-run="${run.id}">Остановить роль</button>`;
    if(r.summary){
      h+=`<p>${escapeHTML(r.summary)}</p><p class="source">Проверены структура, ссылки и совпадение цитат с сохранёнными полями. Смысловая обоснованность утверждений и достоверность внешних страниц отдельно не подтверждены.</p>`;
      for(const f of r.findings)h+=`<div class="finding"><strong>${escapeHTML({observation:'Наблюдение',uncertainty:'Неопределённость',issue:'Замечание'}[f.kind])}</strong><p>${escapeHTML(f.claim)}</p><a href="${escapeHTML(f.source_url)}" target="_blank" rel="noopener noreferrer">Источник ↗</a>${f.evidence.map(e=>`<blockquote>${escapeHTML(e.quote)}<small>Поле: ${escapeHTML(e.field)}</small></blockquote>`).join('')}</div>`;
      if(r.next_steps.length)h+='<strong>Следующие действия</strong><ul>'+r.next_steps.map(v=>'<li>'+escapeHTML(v)+'</li>').join('')+'</ul>';
      h+='<p class="muted">'+r.limitations.map(escapeHTML).join(' · ')+'</p>';
      if(run.usage.elapsed_seconds!==undefined)h+=`<small>${escapeHTML(run.usage.elapsed_seconds)} сек. · ${run.provider==='ollama'?'Локальное вычисление, API: $0':'Фактическая стоимость аккаунта не измерена'}</small>`;
    }
    return h+'</article>';
  }).join('');
  document.querySelectorAll('[data-copy-prompt]').forEach(b=>b.onclick=()=>action(async()=>{
    const response=await fetch('/api/agents/'+b.dataset.copyPrompt+'/prompt');
    if(!response.ok)throw new Error('Не удалось получить запрос');
    const prompt=await response.text();
    try{await navigator.clipboard.writeText(prompt);message('Запрос скопирован.');}
    catch(_){message('Буфер недоступен в этом браузере. Используй «Скачать запрос».');}
  }));
  document.querySelectorAll('[data-paste-run]').forEach(f=>f.onsubmit=e=>{e.preventDefault();action(async()=>{
    let raw=new FormData(f).get('reply').trim();
    const block=raw.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);if(block)raw=block[1];
    const data=JSON.parse(raw);await api('/api/agents/'+f.dataset.pasteRun+'/import',data);
    await showTask(selected);message('Ответ сохранён и проверен по формату и цитатам.');
  });});
  document.querySelectorAll('[data-import-run]').forEach(b=>b.onclick=()=>{importingRun=b.dataset.importRun;$('#agent-file').click();});
  document.querySelectorAll('[data-cancel-run]').forEach(b=>b.onclick=()=>action(async()=>{await api('/api/agents/'+b.dataset.cancelRun+'/cancel',{});await showTask(selected);message('Роль остановлена; исходные данные сохранены.');}));
}
async function refreshProviders(){
  $('#provider-list').textContent='Проверяем этот компьютер…';
  inventory=await api('/api/providers');
  const d=inventory.hardware;
  $('#hardware').textContent=`Этот компьютер: ${d.os} · ${d.architecture}${d.memory_gb?' · '+d.memory_gb+' ГБ памяти':''}. ${d.is_apple_silicon?'Apple Silicon подтверждён.':'Характеристики другого Mac здесь определить нельзя.'}`;
  const names={ready:'Обнаружен · пробный вызов ещё нужен',unavailable:'Не обнаружен',manual:'Ручная передача',no_models:'Нет локальных моделей',incompatible:'Нужна совместимая версия',sign_in_required:'Нужен вход',billing_unknown:'Способ оплаты не подтверждён',unknown:'Не удалось проверить'};
  $('#provider-list').innerHTML=inventory.providers.map(p=>`<div class="tool-row"><strong>${escapeHTML(p.name)}</strong> <span class="badge ${p.status==='ready'?'':'warn'}">${escapeHTML(names[p.status]||p.status)}</span><p>${escapeHTML(p.note)}</p>${p.version?'<small>'+escapeHTML(p.version)+'</small>':''}${p.models?.length?'<ul>'+p.models.map(m=>`<li>${escapeHTML(m.name)} · файл ${m.size_gb} ГБ</li>`).join('')+'</ul>':''}</div>`).join('');
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{setView(b.dataset.view);if(b.dataset.view==='quality')action(refreshQuality);if(b.dataset.view==='workloop')action(refreshWorkLoop);if(b.dataset.view==='outcomes')action(refreshOutcomes);});
$('#create-form').onsubmit=e=>{e.preventDefault();action(async()=>{const task=await api('/api/tasks',{objective:$('#objective').value});$('#objective').value='';await showTask(task.id);message('План создан. Материалы можно подготовить в ChatGPT.');});};
$('#pilot-button').onclick=()=>action(async()=>{const demo=await api('/api/demo-report');selected=null;$('#task-detail').innerHTML='<h2>Исторический пример · 25.09.2026</h2><pre class="evidence-preview">'+escapeHTML(demo.report)+'</pre>';message('Это демонстрация на фиксированную дату, не актуальные предложения.');});
$('#notes-form').onsubmit=e=>{e.preventDefault();action(async()=>{await api('/api/profile',{notes:$('#notes').value});await refresh();message('Контекст сохранён для следующих задач.');});};
$('#materials-file').onchange=e=>action(async()=>{const f=e.target.files[0];try{if(!f)return;if(f.size>2000000)throw new Error('Файл должен быть не больше 2 МБ');const data=JSON.parse(await f.text());await api('/api/tasks/'+selected+'/import',data);await showTask(selected);message('Материалы добавлены. Нажми «Продолжить обработку».');}finally{e.target.value='';}});
$('#agent-file').onchange=e=>action(async()=>{const f=e.target.files[0];try{if(!f)return;if(f.size>2000000)throw new Error('Файл должен быть не больше 2 МБ');const data=JSON.parse(await f.text());await api('/api/agents/'+importingRun+'/import',data);await showTask(selected);message('Ответ сохранён. Исходные материалы не изменялись.');}finally{e.target.value='';}});
$('#detect-providers').onclick=()=>action(refreshProviders);
setInterval(async()=>{if(busy||!selected)return;const id=selected;try{const task=await api('/api/tasks/'+id);if(selected===id&&JSON.stringify(task.agent_runs)!==runsSignature)renderRuns(task.agent_runs);}catch(_){/* Keep the last saved state visible; explicit actions show connection errors. */}},2000);
action(async()=>{await refresh();if(state.tasks.length)await showTask(state.tasks[0].id);});
