(() => {
  'use strict';
  const $ = s => document.querySelector(s), ui = window.MusashiUI;
  if (!ui) return;
  const cover = $('#cover'), toggle = $('#gate-toggle'), reduced = matchMedia('(prefers-reduced-motion: reduce)'), fine = matchMedia('(pointer: fine)');
  const motionOff = () => reduced.matches || document.body.classList.contains('no-motion');
  let entered = false, switchTimer, finishTimer, pointerFrame, scrollFrame;
  function showGate() {
    cover.classList.toggle('gate-entered', entered);
    toggle.setAttribute('aria-pressed', String(entered));
    const gateLabel = toggle.querySelector('.gate-label'); const gateText = entered ? 'Повернути самурая' : 'Відкрити ворота';
    if (gateLabel) gateLabel.textContent = gateText; else toggle.innerHTML = gateText + ' <span aria-hidden="true">↔</span>';
    $('#scene-label').textContent = entered ? '01 / Справжній смак' : '01 / Світ Musashi';
  }
  function finishGate() {
    clearTimeout(switchTimer); clearTimeout(finishTimer);
    showGate(); cover.classList.remove('scene-transition'); toggle.disabled = false;
  }
  toggle.addEventListener('click', () => {
    entered = !entered;
    if (motionOff()) { finishGate(); return; }
    toggle.disabled = true;
    cover.classList.remove('scene-transition'); void cover.offsetWidth; cover.classList.add('scene-transition');
    switchTimer = setTimeout(showGate, 400);
    finishTimer = setTimeout(finishGate, 1350);
  });
  function resetDepth() {
    cancelAnimationFrame(pointerFrame);
    cover.style.setProperty('--mx','0px'); cover.style.setProperty('--my','0px');
  }
  cover.addEventListener('pointermove', e => {
    if (motionOff() || !fine.matches || e.pointerType === 'touch' || document.hidden) return;
    const r = cover.getBoundingClientRect(), x = ((e.clientX-r.left)/r.width-.5)*22, y = ((e.clientY-r.top)/r.height-.5)*18;
    cancelAnimationFrame(pointerFrame);
    pointerFrame=requestAnimationFrame(() => {cover.style.setProperty('--mx',`${x.toFixed(2)}px`);cover.style.setProperty('--my',`${y.toFixed(2)}px`);});
  });
  cover.addEventListener('pointerleave', resetDepth);
  function scrollDepth() {
    cancelAnimationFrame(scrollFrame);
    scrollFrame=requestAnimationFrame(() => {
      const r=cover.getBoundingClientRect();
      if(motionOff()||document.hidden||innerWidth<=700||r.bottom<0||r.top>innerHeight){cover.style.setProperty('--travel','0px');return;}
      cover.style.setProperty('--travel',`${Math.max(0,Math.min(1,-r.top/r.height))*90}px`);
    });
  }
  addEventListener('scroll',scrollDepth,{passive:true});addEventListener('resize',scrollDepth,{passive:true});

  const section=$('#pour'), hold=$('#pour-hold'), status=$('#pour-status');
  let row, fill=0, holding=false, automatic=false, pourFrame, previousTime, pressedAt=0, pointerClickUntil=0;
  const running = () => holding || automatic;
  function paintFill() {
    section.style.setProperty('--fill',fill.toFixed(4));
    section.classList.toggle('pour-complete',fill>=1);
    $('#pour-button-label').innerHTML=fill>=1?'Готово<br>✓':running()?'Наливаємо…':fill>0?'Продовжити<br>наливати':'Утримуй<br>і наливай';
  }
  function stopPour() {
    holding=false;automatic=false;cancelAnimationFrame(pourFrame);previousTime=undefined;section.classList.remove('pouring');
    status.textContent=fill>=1?'Смачного!':fill>0?'Продовжимо?':'Келих чекає';paintFill();
  }
  function tick(time) {
    if(!running()||document.hidden||section.hidden){stopPour();return;}
    if(previousTime!==undefined)fill=Math.min(1,fill+Math.max(0,time-previousTime)/2400);
    previousTime=time;paintFill();
    if(fill>=1){stopPour();return;}
    pourFrame=requestAnimationFrame(tick);
  }
  function beginPour(auto=false) {
    if(fill>=1){fill=0;paintFill();}
    if(motionOff()){fill=1;paintFill();stopPour();return;}
    automatic=auto;holding=!auto;previousTime=undefined;cancelAnimationFrame(pourFrame);section.classList.add('pouring');status.textContent='Наповнюємо…';pourFrame=requestAnimationFrame(tick);
  }
  hold.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    pressedAt=performance.now();pointerClickUntil=pressedAt+10000;
    hold.setPointerCapture(e.pointerId);beginPour(false);
  });
  hold.addEventListener('pointerup',e=>{
    if(!pressedAt)return;
    const tap=performance.now()-pressedAt<230;pressedAt=0;pointerClickUntil=performance.now()+500;
    holding=false;if(tap&&fill<1&&!motionOff()){automatic=true;}else stopPour();
    if(hold.hasPointerCapture(e.pointerId))hold.releasePointerCapture(e.pointerId);
  });
  hold.addEventListener('pointercancel',()=>{pressedAt=0;stopPour();});
  hold.addEventListener('lostpointercapture',()=>{if(holding)stopPour();});
  hold.addEventListener('click',()=>{if(performance.now()<pointerClickUntil)return;beginPour(true);});
  $('#pour-shortcut').addEventListener('click',()=>section.scrollIntoView({behavior:motionOff()?'instant':'smooth'}));
  $('#pour-reset').addEventListener('click',()=>{stopPour();fill=0;paintFill();status.textContent='Келих чекає';});
  $('#pour-dish').addEventListener('click',()=>{if(row)ui.openDish(row.si,row.ci,row.ii);});
  function updatePour() {
    stopPour();fill=0;paintFill();
    row=ui.rows().find(r=>r.item.image==='assets/dish-81.webp'&&/Лимонад манго/i.test(r.item.name));
    section.hidden=!row;$('#pour-shortcut').hidden=!row;
    if(row){$('#pour-caption').textContent=row.item.name+' · '+row.item.price;$('#pour-dish').textContent='Дивитися напій · '+row.item.price+' →';}
  }
  document.addEventListener('musashi:venue',updatePour);
  function syncMotion() {resetDepth();scrollDepth();if(motionOff()){finishGate();stopPour();}}
  document.addEventListener('musashi:motion',syncMotion);reduced.addEventListener('change',syncMotion);
  document.addEventListener('visibilitychange',()=>{if(document.hidden){resetDepth();stopPour();finishGate();}else scrollDepth();});
  if('IntersectionObserver' in window){new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)stopPour();},{threshold:.05}).observe(section);}
  updatePour();scrollDepth();
})();
