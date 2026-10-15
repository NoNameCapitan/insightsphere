'use strict';
let outcomeProject='';
const outField=(name,label,value='',type='text')=>`<label>${escapeHTML(label)}<input name="${name}" type="${type}" value="${escapeHTML(value)}" required></label>`;
const outArea=(name,label,value='')=>`<label>${escapeHTML(label)}<textarea name="${name}" required>${escapeHTML(value)}</textarea></label>`;
const money=v=>v==null?'неизвестно':(v/100).toFixed(2);
async function refreshOutcomes(){
 const [o,w,catalog]=await Promise.all([api('/api/outcomes'),api('/api/workloop'),api('/api/pain-catalog')]);
 if(!w.projects.some(p=>p.id===outcomeProject))outcomeProject=w.projects[0]?.id||'';
 const b=o.briefs.find(x=>x.project_id===outcomeProject), p=b?.packet;
 let h=`<div class="notice">Фокус: принятый результат и затраты всех попыток. Проверки и расходы вводит владелец; это не банковский учёт, не автоматическое тестирование и не подтверждение личности клиента.</div>
 <details class="quality-block"><summary>1. Какие боли проверяем</summary>${catalog.map(c=>`<article><h3>${escapeHTML(c.title)}</h3><p>${escapeHTML(c.signal)}</p><p><strong>Статус:</strong> ${escapeHTML(c.status)}. <strong>Наш ответ:</strong> ${escapeHTML(c.solution)}</p><a href="${escapeHTML(c.url)}" target="_blank" rel="noopener noreferrer">Источник</a></article>`).join('')}<p>Эти сигналы не доказывают отсутствие решений у конкурентов или готовность клиентов платить.</p></details>
 <details class="quality-block"><summary>2. Записать интервью или сигнал</summary><form id="out-signal">
 ${outField('segment','Сегмент: например, небольшие агентства')}${outField('customer_alias','Уникальный псевдоним клиента / автора')}
 <label>Источник<select name="kind"><option value="interview">Интервью — запись владельца</option><option value="public_report">Публичная жалоба</option><option value="pilot">Опыт пилота — запись владельца</option></select></label>
 ${outArea('source','Ссылка на публикацию или дата и заметка разговора')}${outArea('pain','Последний конкретный случай проблемы')}${outArea('workaround','Как решают сейчас и почему недостаточно')}${outField('minutes','Минут потерь в этом случае (оценка)',0,'number')}
 <label>Интерес<select name="intent"><option value="unknown">Не выяснен</option><option value="declined">Не интересно</option><option value="interested">Интересно</option><option value="pilot_agreed">Согласен на пилот — со слов владельца</option></select></label><button>Записать сигнал</button></form>
 <p>Сигналов: ${o.signals.length}. Это не число платящих клиентов.</p>${o.signals.slice(0,15).map(s=>`<p><strong>${escapeHTML(s.segment)} / ${escapeHTML(s.customer_alias)}</strong>: ${escapeHTML(s.pain)} · ${escapeHTML(s.intent)}</p>`).join('')}</details>
 <label>Проект<select id="out-project">${loopOption('','Сначала создайте проект в «Досвід і клієнти»')}${w.projects.map(x=>loopOption(x.id,x.title,x.id===outcomeProject)).join('')}</select></label>`;
 if(outcomeProject){
 const m=o.summaries.find(x=>x.project_id===outcomeProject);
 if(m)h+=`<div class="notice"><strong>${m.accepted_by_owner?'Последняя проверка текущего брифа: принята владельцем':'Текущий результат ещё не принят'}</strong><p>Версия ${m.revision}; проверок всех версий: ${m.attempts}; время владельца: ${m.owner_minutes} мин.</p><p>Полные записанные затраты с оценкой труда: ${money(m.total_recorded_cost_minor)} ${escapeHTML(p.currency)}. Известная часть прямых затрат: ${money(m.known_recorded_direct_minor)}.</p><p>Затраты до принятого результата: ${money(m.cost_of_accepted_result_minor)}. Плановый остаток от цены: ${money(m.planned_contribution_minor)}. Это не доход.</p><p>Состояние относительно бюджета: ${escapeHTML({unknown:'неизвестно',exceeded:'превышен',within:'в пределах'}[m.budget_status])}. Лимит здесь информационный, внешние расходы не блокирует. Труд всех попыток оценён по текущей ставке.</p></div>`;
 h+=`<details class="quality-block" ${b?'':'open'}><summary>3. ${b?'Новая версия брифа':'Бриф и условия приёмки'}</summary><p>Изменение объёма создаёт новую версию. Предыдущая приёмка не переносится. Каждая версия сохраняется.</p><form id="out-brief">
 ${outArea('problem','Какая проблема решается',p?.problem||'')}${outArea('deliverable','Что именно отдаём',p?.deliverable||'')}${outArea('excluded','Что не входит',p?.excluded||'')}${outField('deadline','Срок',p?.deadline||'')}
 <label>Валюта<select name="currency">${['UAH','USD','EUR'].map(c=>loopOption(c,c,c===(p?.currency||'UAH'))).join('')}</select></label>
 ${outField('price','Плановая цена заказа',money(p?.price_minor??0))}${outField('budget','Плановый бюджет затрат, включая труд',money(p?.budget_minor??0))}${outField('hourly','Оценка часа своего труда',money(p?.hourly_minor??0))}
 ${outArea('criteria','3–10 критериев: каждый с новой строки',(p?.criteria||['Результат соответствует согласованным входным данным','Есть воспроизводимый пример проверки','Инструкция позволяет клиенту повторить запуск']).join('\n'))}${outArea('reason','Причина создания или изменения',b?'':'Первичная постановка задачи')}<button>Сохранить версию</button></form></details>`;
 if(b){
 h+=`<p><a href="/api/outcome-handoff/${encodeURIComponent(outcomeProject)}">Скачать пакет требований для исполнителя ↓</a> · Бриф №${b.revision}</p>
 <details class="quality-block"><summary>4. Проверить результат по брифу №${b.revision}</summary><p>Доказательства вводятся вручную. Приложение проверяет заполнение и версию, но не истинность. Ссылка не фиксирует содержимое внешнего файла: укажите неизменяемую версию или вставьте результат.</p><form id="out-attempt">
 ${outArea('artifact','Текст результата или точная версия артефакта и ссылка')}
 ${p.criteria.map((c,i)=>`<fieldset><legend>${i+1}. ${escapeHTML(c)}</legend><label>Вердикт<select name="pass${i}"><option value="false">Не выполнено / не проверено</option><option value="true">Выполнено — проверено владельцем</option></select></label>${outArea('proof'+i,'Доказательство или воспроизведение дефекта')}</fieldset>`).join('')}
 ${outField('reviewer','Кто проверил')}${outArea('note','Основание общего решения')}<label>Прямые затраты этой попытки (пусто = неизвестно)<input name="cost" placeholder="0.00"></label>${outField('owner_minutes','Минуты вашей работы в этой попытке',0,'number')}<button>Записать проверку</button></form></details>
 <details class="quality-block"><summary>История версий и проверок</summary>${o.briefs.filter(v=>v.project_id===outcomeProject).map(v=>`<article><h3>Бриф №${v.revision}</h3><p>${escapeHTML(v.packet.reason)}</p><p>${escapeHTML(v.packet.deliverable)}</p><ol>${v.packet.criteria.map(c=>`<li>${escapeHTML(c)}</li>`).join('')}</ol>${o.attempts.filter(a=>a.brief_id===v.id).map(a=>`<details><summary>${a.accepted?'Принято владельцем':'Нужна доработка'} · ${escapeHTML(a.reviewer)}</summary><pre class="evidence-preview">${escapeHTML(a.artifact)}</pre><p>${escapeHTML(a.note)}</p>${a.checks.map((c,i)=>`<p>${i+1}. ${c.passed?'Да':'Нет'}: ${escapeHTML(c.evidence)}</p>`).join('')}</details>`).join('')}</article>`).join('')}</details>
 <p>Для улучшения агента откройте «Досвід і клієнти», выберите связанное задание и сохраните отзыв. Общую инструкцию меняйте через проверяемого кандидата; приёмка здесь сама её не меняет.</p>`;
 }
 }
 $('#outcomes-content').innerHTML=h;
 $('#out-project').onchange=e=>{outcomeProject=e.target.value;action(refreshOutcomes);};
 const bind=(id,fn)=>{const f=$('#'+id);if(f)f.onsubmit=e=>{e.preventDefault();action(async()=>{await fn(Object.fromEntries(new FormData(f)));await refreshOutcomes();message('Сохранено');});};};
 bind('out-signal',v=>api('/api/outcomes/signal',{...v,minutes:Number(v.minutes)}));
 bind('out-brief',v=>api('/api/outcomes/brief',{project_id:outcomeProject,expected_revision:b?.revision||0,packet:{problem:v.problem,deliverable:v.deliverable,excluded:v.excluded,deadline:v.deadline,currency:v.currency,price_minor:minorAmount(v.price),budget_minor:minorAmount(v.budget),hourly_minor:minorAmount(v.hourly),criteria:v.criteria.split('\n').map(x=>x.trim()).filter(Boolean),reason:v.reason}}));
 bind('out-attempt',v=>api('/api/outcomes/attempt',{brief_id:b.id,expected_hash:b.hash,artifact:v.artifact,checks:p.criteria.map((_,i)=>({passed:v['pass'+i]==='true',evidence:v['proof'+i]})),reviewer:v.reviewer,note:v.note,cost_minor:v.cost.trim()===''?null:minorAmount(v.cost),owner_minutes:Number(v.owner_minutes)}));
}
