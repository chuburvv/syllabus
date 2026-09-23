(function () {
  'use strict';
  // A restored fragment must not trigger WebKit's deferred document scroll
  // after we restore the independent reader's precise offset.
  var startupHash = location.hash;
  if (startupHash) history.replaceState(null, '', location.pathname + location.search);
  var LS = null, memory = Object.assign({}, window.__nativeState || {});
  try { LS = window.localStorage; } catch (_) {}
  function get(k, fallback) {
    if (Object.prototype.hasOwnProperty.call(memory, k)) return memory[k];
    try { var value = LS && LS.getItem(k); return value == null ? fallback : value; } catch (_) { return fallback; }
  }
  function set(k, value) {
    value = String(value);
    if (get(k, null) === value) return;
    memory[k] = value;
    try { if (LS) LS.setItem(k, value); } catch (_) {}
    try {
      if (window.webkit && window.webkit.messageHandlers.setting)
        window.webkit.messageHandlers.setting.postMessage({key:k, value:value});
    } catch (_) {}
  }
  var main = document.querySelector('main'), sidebar = document.getElementById('sidebar');
  var toc = document.getElementById('toc'), search = document.getElementById('tocSearch');
  var burger = document.getElementById('burger'), backdrop = document.getElementById('menuBackdrop');
  var topics = Array.from(document.querySelectorAll('.topic[id]'));
  var ready = false, scrollTimer, current = null, positions = [];
  var header = document.querySelector('.topbar');
  function measure() {
    document.documentElement.style.setProperty('--header-height', header.offsetHeight + 'px');
    document.documentElement.style.setProperty('--reader-height', (window.visualViewport ? window.visualViewport.height : window.innerHeight) + 'px');
    positions = Array.from(main.querySelectorAll('.part[id], .topic[id]')).map(function(el) {
      return {el:el, top:el.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop};
    });
  }
  new ResizeObserver(measure).observe(header);
  new ResizeObserver(function () { measure(); }).observe(main);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', measure);
  function setCurrent(id) {
    if (current === id) return;
    current = id;
    toc.querySelectorAll('.current').forEach(function(a) { a.classList.remove('current'); a.removeAttribute('aria-current'); });
    var link = toc.querySelector('a[href="#' + id + '"]');
    if (link) { link.classList.add('current'); link.setAttribute('aria-current', 'location'); }
  }
  function locationNow() {
    var top = main.scrollTop, entry = null;
    for (var i = 0; i < positions.length; i++) {
      if (positions[i].top <= top + 24) entry = positions[i]; else break;
    }
    return entry ? {id:entry.el.id, offset:top - entry.top} : {id:'', offset:top};
  }
  function savePosition() {
    if (!ready) return;
    var loc = locationNow(); set('ya-reading', JSON.stringify(loc)); setCurrent(loc.id);
  }
  function restorePosition(loc) {
    measure();
    var target = loc && loc.id && document.getElementById(loc.id);
    var base = target ? target.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop : 0;
    main.scrollTop = Math.max(0, base + (Number(loc && loc.offset) || 0));
    setCurrent(loc && loc.id || '');
  }
  main.addEventListener('scroll', function () { clearTimeout(scrollTimer); scrollTimer = setTimeout(savePosition, 120); }, {passive:true});
  window.addEventListener('pagehide', savePosition);
  document.addEventListener('visibilitychange', function () { if (document.hidden) savePosition(); });
  window.bookSavePosition = savePosition;
  function menu(open) {
    if (!open && sidebar.contains(document.activeElement)) document.activeElement.blur();
    document.body.classList.toggle('side-open', open);
    burger.setAttribute('aria-expanded', String(open));
    sidebar.inert = !open; main.inert = open; backdrop.hidden = !open;
    if (open && current) {
      var a = toc.querySelector('a[href="#' + current + '"]');
      if (a) {
        var section = a.closest('.toc > li');
        if (section) { section.classList.add('open'); section.querySelector('.toc-part').setAttribute('aria-expanded','true'); }
        // Scroll ONLY the menu. Never scroll the page toward an off-screen sidebar.
        sidebar.scrollTop += a.getBoundingClientRect().top - sidebar.getBoundingClientRect().top - 150;
      }
    }
  }
  burger.addEventListener('click', function () { menu(!document.body.classList.contains('side-open')); });
  document.getElementById('closeMenu').addEventListener('click', function () { menu(false); burger.focus({preventScroll:true}); });
  backdrop.addEventListener('click', function () { menu(false); });
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { menu(false); burger.focus({preventScroll:true}); }
  });
  toc.querySelectorAll('.toc-part').forEach(function(a) {
    a.setAttribute('aria-expanded','false');
    a.addEventListener('click', function(e) {
      e.preventDefault();
      var li = a.parentElement, open = !li.classList.contains('open');
      li.classList.toggle('open',open); a.setAttribute('aria-expanded',String(open));
    });
  });
  function navigate(id, historyEntry) {
    var target = document.getElementById(id); if (!target) return;
    menu(false);
    requestAnimationFrame(function () {
      measure();
      main.scrollTop += target.getBoundingClientRect().top - main.getBoundingClientRect().top - 16;
      if (historyEntry && location.hash !== '#' + id) history.pushState(null,'','#' + id);
      savePosition(); setCurrent(id);
    });
  }
  document.addEventListener('click',function(e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a || a.classList.contains('toc-part')) return;
    var id = a.getAttribute('href').slice(1);
    if (document.getElementById(id)) { e.preventDefault(); navigate(id,true); }
  });
  window.addEventListener('popstate',function() { if(location.hash) navigate(location.hash.slice(1),false); else {main.scrollTop=0;savePosition();} });
  search.addEventListener('input', function () {
    var q = search.value.trim().toLocaleLowerCase('ru'), found = 0;
    toc.querySelectorAll(':scope > li').forEach(function(li) {
      var heading = li.querySelector('.toc-part');
      var selfMatch = !!q && heading.textContent.toLocaleLowerCase('ru').includes(q), any = false;
      li.querySelectorAll('ul li').forEach(function(sub) {
        var match = !q || selfMatch || sub.textContent.toLocaleLowerCase('ru').includes(q);
        sub.classList.toggle('hidden',!match); if(match) any=true;
      });
      li.classList.toggle('hidden', !(any || selfMatch));
      if(any || selfMatch) found++;
      if(q && (any || selfMatch)) {li.classList.add('open');heading.setAttribute('aria-expanded','true');}
    });
    document.getElementById('searchEmpty').hidden = found !== 0;
  });
  var themeBtn = document.getElementById('themeBtn');
  function applyTheme(t) {document.documentElement.setAttribute('data-theme',t); themeBtn.textContent=t==='dark'?'Светлая':'Тёмная';}
  applyTheme(get('ya-theme','light'));
  themeBtn.addEventListener('click',function() {var t=document.documentElement.dataset.theme==='dark'?'light':'dark';applyTheme(t);set('ya-theme',t);});
  var filter=document.getElementById('filter');
  function applyFilter(f) {
    if(!['all','junior','middle','senior','head'].includes(f)) f='all';
    document.body.setAttribute('data-filter',f);
    filter.querySelectorAll('.btn').forEach(function(b) {var active=b.dataset.f===f;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    measure();
  }
  applyFilter(get('ya-filter','all'));
  filter.addEventListener('click',function(e) {
    var b=e.target.closest('[data-f]');if(!b)return;
    var loc=locationNow();applyFilter(b.dataset.f);set('ya-filter',b.dataset.f);restorePosition(loc);savePosition();
  });
  function updateProgress() {
    var done=topics.filter(function(t){return t.classList.contains('done');}).length;
    document.getElementById('progressBar').style.width=(topics.length?100*done/topics.length:0)+'%';
    document.getElementById('progressLabel').textContent=done+' / '+topics.length+' тем изучено';
  }
  document.querySelectorAll('input.studied-chk').forEach(function(cb) {
    var id=cb.dataset.topic,t=document.getElementById(id),a=toc.querySelector('a[href="#'+id+'"]');
    function sync(){t.classList.toggle('done',cb.checked);if(a)a.classList.toggle('done',cb.checked);}
    cb.checked=get('ya-done-'+id,'0')==='1';sync();
    cb.addEventListener('change',function(){set('ya-done-'+id,cb.checked?'1':'0');sync();updateProgress();});
  });
  document.querySelectorAll('input.chk[data-id]').forEach(function(cb){
    var key='ya-chk-'+cb.dataset.id;cb.checked=get(key,'0')==='1';
    cb.addEventListener('change',function(){set(key,cb.checked?'1':'0');});
  });
  document.querySelectorAll('details').forEach(function(d,i){
    var key='ya-detail-'+i; d.open=get(key,'0')==='1';
    d.addEventListener('toggle',function(){if(ready){set(key,d.open?'1':'0');measure();savePosition();}});
  });
  document.querySelectorAll('.tbl-wrap').forEach(function(w){
    var hint=document.createElement('p');hint.className='table-hint';hint.textContent='Таблицу можно прокручивать влево и вправо';w.before(hint);
    w.tabIndex=0;w.setAttribute('role','region');w.setAttribute('aria-label','Таблица с горизонтальной прокруткой');
  });
  updateProgress();
  var first=toc.querySelector(':scope > li');if(first){first.classList.add('open');first.querySelector('.toc-part').setAttribute('aria-expanded','true');}
  var saved=null;try{saved=JSON.parse(get('ya-reading','null'));}catch(_){}
  requestAnimationFrame(function(){requestAnimationFrame(function(){
    measure(); if(saved)restorePosition(saved); ready=true;
    if(!saved && startupHash)navigate(startupHash.slice(1),false);
  });});
})();
