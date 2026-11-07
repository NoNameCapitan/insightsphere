(() => {
  'use strict';
  const ui = window.MusashiUI;
  if (!ui) return;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const cover = $('#cover'), photo = $('#hero-food'), picture = $('#hero-food-image');
  const story = $('#story'), barSelection = $('#bar-selection');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(pointer: fine)');
  const off = () => reduced.matches || document.body.classList.contains('no-motion');
  let course = 0, picks = [], current, barKind = 'alcohol', barRows = [], barSections = {};
  let changeTimer, endTimer, catalogTimer, barTimer, pointFrame;
  let downPoint, preventClick = false;
  const courseLabel = index => index === 0 ? 'Рамен' : index === 2
    ? (/лимонад/i.test(picks[index]?.item.name || '') ? 'Лимонад' : 'Напій')
    : (/[ҐГ]ьодза/i.test(picks[index]?.item.name || '') ? 'Ґьодза' : /БАО/i.test(picks[index]?.categoryTitle || '') ? 'Бао' : 'Роли');
  const isSoftRow = r => /^БАР Б\/А/.test(r.sectionTitle) ||
    (/^БАР/.test(r.sectionTitle) && /Б\/А|ЛИМОНАД|НАПОЇ|ЧАЙ|TEA|КАВА|ФРЕШ/i.test(r.categoryTitle));

  function chooseRows() {
    const rows = ui.rows();
    const food = rows.filter(r => r.sectionTitle.startsWith('ОСНОВНЕ') && r.item.image);
    const soft = rows.filter(r => isSoftRow(r) && r.item.image);
    picks = [
      food.find(r => /Рамен з куркою Абурі/i.test(r.item.name)) || food.find(r => /РАМЕН/i.test(r.categoryTitle)) || food[0],
      food.find(r => /[ҐГ]ьодза.*кур/i.test(r.item.name)) || food.find(r => /[ҐГ]ьодза/i.test(r.item.name)) || food.find(r => /БАО/i.test(r.categoryTitle)) || food.find(r => /РОЛИ/i.test(r.categoryTitle)),
      soft.find(r => /Лимонад манго.маракуйя/i.test(r.item.name)) || soft.find(r => /лимонад/i.test(r.item.name)) || soft[0]
    ];
    for (const [i, button] of $$('button[data-course]').entries()) {
      button.hidden = !picks[i];
      button.textContent = courseLabel(i);
    }
    for (const row of picks.filter(Boolean)) {
      const preload = new Image();
      preload.src = imageFor(row);
    }
    if (picks[0]) {
      $('#cooking-bowl-image').src = imageFor(picks[0]);
      $('#cooking-bowl-image').alt = picks[0].item.name;
      $('#cooking-bowl-caption').textContent = picks[0].item.name + ' · ' + picks[0].item.price;
    }
    if (!picks[course]) course = 0;
    selectCourse(course, false);
    const sections = ui.getVenue().sections;
    barSections = {
      alcohol: sections.findIndex(s => s.title.startsWith('БАР') && !s.title.startsWith('БАР Б/А')),
      soft: sections.findIndex(s => s.title.startsWith('БАР Б/А'))
    };
    if (barSections.soft < 0) barSections.soft = rows.find(isSoftRow)?.si ?? -1;
    $$('[data-bar]').forEach(button => button.disabled = barSections[button.dataset.bar] < 0);
    if (barSections[barKind] < 0) barKind = barSections.soft >= 0 ? 'soft' : 'alcohol';
    renderBar(false);
  }

  function imageFor(row) {
    return row.item.largeImage || (row.item.image === 'assets/dish-2.webp' ? 'assets/extra-161.webp' : row.item.image);
  }
  function showCourse(index) {
    const row = picks[index];
    if (!row) return;
    current = row;
    picture.src = imageFor(row);
    picture.alt = row.item.name;
    photo.setAttribute('aria-label', `Склад і варіанти: ${row.item.name}`);
    $('#hero-dish-name').textContent = row.item.name;
    $('#hero-price').textContent = row.item.price || 'В офіційному меню';
    $('#hero-venue').textContent = ui.getVenue().name;
    $('#feature-category').textContent = courseLabel(index);
    $('.feature-calligraphy').textContent = ['麺','味','爽'][index];
    cover.dataset.course = String(index);
  }
  function selectCourse(index, animate = true) {
    if (!picks[index]) return;
    course = index;
    clearTimeout(changeTimer); clearTimeout(endTimer);
    photo.classList.remove('switching','arriving');
    $$('button[data-course]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.course === index)));
    if (off() || !animate) { showCourse(index); return; }
    void photo.offsetWidth;
    photo.classList.add('switching');
    changeTimer = setTimeout(() => {
      showCourse(index);
      photo.classList.add('arriving');
    }, 260);
    endTimer = setTimeout(() => photo.classList.remove('switching','arriving'), 1000);
  }
  function nextCourse(direction = 1) {
    const available = picks.map((r,i) => r ? i : null).filter(i => i !== null);
    selectCourse(available[(available.indexOf(course) + direction + available.length) % available.length]);
  }
  $$('button[data-course]').forEach(b => b.addEventListener('click', () => selectCourse(+b.dataset.course)));
  $('#next-course').addEventListener('click', () => nextCourse());
  $('#cover-feature').addEventListener('keydown', e => {
    if (!['ArrowLeft','ArrowRight'].includes(e.key)) return;
    e.preventDefault(); nextCourse(e.key === 'ArrowRight' ? 1 : -1);
  });
  photo.addEventListener('click', () => {
    if (preventClick) { preventClick = false; return; }
    if (current) ui.openDish(current.si, current.ci, current.ii);
  });
  photo.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') downPoint = {x:e.clientX,y:e.clientY};
  });
  photo.addEventListener('pointerup', e => {
    if (!downPoint) return;
    const dx = e.clientX - downPoint.x, dy = e.clientY - downPoint.y;
    downPoint = null;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      preventClick = true; nextCourse(dx < 0 ? 1 : -1);
      setTimeout(() => preventClick = false, 350);
    }
  });
  photo.addEventListener('pointercancel', () => downPoint = null);
  photo.addEventListener('pointermove', e => {
    if (off() || !finePointer.matches || e.pointerType === 'touch') return;
    const rect = photo.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - .5;
    const y = (e.clientY - rect.top) / rect.height - .5;
    cancelAnimationFrame(pointFrame);
    pointFrame = requestAnimationFrame(() => {
      photo.style.setProperty('--fx', `${x * -7}px`);
      photo.style.setProperty('--fy', `${y * -5}px`);
    });
  });
  photo.addEventListener('pointerleave', () => {
    cancelAnimationFrame(pointFrame);
    photo.style.removeProperty('--fx'); photo.style.removeProperty('--fy');
    downPoint = null;
  });

  let cookingPaused = false;
  const cookingCopy = {
    broth: ['Гарячий початок.', 'У кожного рамену — свій бульйон і характер. Склад та позначки дивись у картці страви.'],
    noodles: ['Локшина, за якою тягнуться.', 'Підіймаємо палички — і починається найапетитніша частина історії.'],
    serve: ['Тепер твоя черга.', 'Обери рамен свого закладу, переглянь склад і доступні варіанти. Смачного!']
  };
  function syncCooking() {
    story.classList.toggle('cooking-paused', cookingPaused);
    const pause = $('#cooking-pause');
    pause.disabled = off();
    pause.setAttribute('aria-pressed', String(cookingPaused || off()));
    pause.textContent = off() ? 'Рух вимкнено' : cookingPaused ? 'Відтворити' : 'Пауза';
  }
  function cookingStep(step) {
    if (!cookingCopy[step]) return;
    story.dataset.step = step;
    $('.cooking-bowl').setAttribute('aria-hidden', String(step !== 'serve'));
    $('.main-chef').setAttribute('aria-hidden', String(step === 'serve'));
    $$('button[data-cooking]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cooking === step)));
    $('#cooking-caption-title').textContent = cookingCopy[step][0];
    $('#cooking-caption-text').textContent = cookingCopy[step][1];
    syncCooking();
  }
  function playStory() {
    cookingPaused = false;
    story.classList.remove('cooking-replay');
    cookingStep('noodles');
    if (off()) return;
    void story.offsetWidth;
    story.classList.add('cooking-replay');
  }
  $$('button[data-cooking]').forEach(b => b.addEventListener('click', () => cookingStep(b.dataset.cooking)));
  $('#replay-story').addEventListener('click', playStory);
  $('#cooking-pause').addEventListener('click', () => { cookingPaused = !cookingPaused; syncCooking(); });
  $('#chef-pick').addEventListener('click', () => { const row = picks[0]; if(row)ui.openDish(row.si,row.ci,row.ii); });
  $$('[data-menu-route]').forEach(b => b.addEventListener('click', () => {
    const sections = ui.getVenue().sections;
    const index = sections.findIndex(section => b.dataset.menuRoute === 'food' ? section.title.startsWith('ОСНОВНЕ') : b.dataset.menuRoute === 'bar' ? section.title.startsWith('БАР') : section.title.includes('ЛАНЧ'));
    if (index >= 0) ui.selectSection(index, '0');
    $('#menu').scrollIntoView({behavior:off() ? 'instant' : 'smooth'});
    $('#section-tabs [aria-selected=true]')?.focus({preventScroll:true});
  }));
  if ('IntersectionObserver' in window) {
    const visibility = new IntersectionObserver(entries => {
      for (const entry of entries) entry.target.classList.toggle('in-view', entry.isIntersecting);
    }, {threshold:.1});
    visibility.observe(cover); visibility.observe(story);
  } else { cover.classList.add('in-view'); story.classList.add('in-view'); }
  syncCooking();

  function renderBar(animate = true) {
    const si = barSections[barKind];
    const rows = ui.rows().filter(r => r.si === si && r.item.image && isSoftRow(r) === (barKind === 'soft'));
    const preferred = barKind === 'alcohol'
      ? rows.filter(r => /КОКТЕЙЛ|COCKTAIL/i.test(r.categoryTitle))
      : rows.filter(r => /Лимонад|Хайбол/i.test(r.item.name));
    barRows = [...preferred, ...rows.filter(r => !preferred.includes(r))].slice(0, 2);
    $$('[data-bar]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.bar === barKind)));
    $('#bar-venue').textContent = ui.getVenue().name;
    $('#bar-menu').innerHTML = `${barSections.alcohol === barSections.soft ? 'Меню бару Torisho' : barKind === 'alcohol' ? 'Усе барне меню' : 'Усі безалкогольні напої'} <span>→</span>`;
    barSelection.innerHTML = barRows.map((r,i) => `<button class="bar-card" data-bar-dish="${i}" aria-label="${escape(r.item.name)} — ${escape(r.item.price)}"><span class="bar-photo"><img src="${escape(r.item.largeImage || r.item.image)}" alt="${escape(r.item.name)}" loading="lazy" width="320" height="240"><b>${barKind === 'alcohol' ? 'BAR / 18+' : 'БЕЗ АЛКОГОЛЮ'}</b></span><span class="bar-caption"><span>${escape(r.item.name)}</span><strong>${escape(r.item.price)}</strong></span><small>Склад і варіанти <span>→</span></small></button>`).join('');
    if (!barRows.length) barSelection.innerHTML = '<p>Добірку напоїв дивись у меню цього закладу.</p>';
    clearTimeout(barTimer); barSelection.classList.remove('changing');
    if (animate && !off()) {
      void barSelection.offsetWidth; barSelection.classList.add('changing');
      barTimer = setTimeout(() => barSelection.classList.remove('changing'), 700);
    }
  }
  $$('[data-bar]').forEach(b => b.addEventListener('click', () => {barKind = b.dataset.bar; renderBar();}));
  barSelection.addEventListener('click', e => {
    const button = e.target.closest('[data-bar-dish]');
    const row = button && barRows[+button.dataset.barDish];
    if (row) ui.openDish(row.si,row.ci,row.ii);
  });
  $('#bar-menu').addEventListener('click', () => {
    ui.selectSection(barSections[barKind]);
    $('#menu').scrollIntoView({behavior:off() ? 'instant' : 'smooth'});
    $('#section-tabs [aria-selected=true]')?.focus({preventScroll:true});
  });
  document.addEventListener('musashi:venue', chooseRows);
  document.addEventListener('musashi:catalog', () => {
    const catalog = $('#catalog');
    clearTimeout(catalogTimer); catalog.classList.remove('catalog-entering');
    if (off() || document.activeElement === $('#search')) return;
    void catalog.offsetWidth; catalog.classList.add('catalog-entering');
    catalogTimer = setTimeout(() => catalog.classList.remove('catalog-entering'), 450);
  });
  function stopEffects() {
    if (!off()) return;
    clearTimeout(changeTimer); clearTimeout(endTimer);
    photo.classList.remove('switching','arriving');
    photo.style.removeProperty('--fx'); photo.style.removeProperty('--fy');
    showCourse(course);
  }
  document.addEventListener('musashi:motion', () => {stopEffects();syncCooking();});
  reduced.addEventListener('change', () => {stopEffects();syncCooking();});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cover.classList.remove('in-view'); story.classList.remove('in-view');
      clearTimeout(changeTimer); clearTimeout(endTimer);
      photo.classList.remove('switching','arriving');
      showCourse(course);
    } else { for(const element of [cover,story]) {const rect=element.getBoundingClientRect();element.classList.toggle('in-view',rect.bottom>0&&rect.top<innerHeight);} }
  });
  chooseRows();
})();
