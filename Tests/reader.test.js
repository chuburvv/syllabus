(async function(){
  const checks=[];
  function assert(ok,name){if(!ok)throw Error(name);checks.push(name);}
  const wait=()=>new Promise(r=>setTimeout(r,220));
  async function until(predicate,name){
    const deadline=Date.now()+10000;
    while(!predicate() && Date.now()<deadline) await wait();
    if(!predicate())throw Error('Timed out: '+name);
  }
  try{
    await wait();
    const main=document.querySelector('main'), menu=document.getElementById('sidebar');
    assert(document.querySelectorAll('.topic').length===127,'127 topics');
    assert(document.documentElement.scrollWidth<=innerWidth,'no horizontal page overflow');
    assert(main.getBoundingClientRect().top>=document.querySelector('.topbar').getBoundingClientRect().bottom,'header does not overlap text');
    document.getElementById('burger').click();
    assert(main.inert&&!menu.inert,'menu traps reading interaction');
    const search=document.getElementById('tocSearch');
    assert(parseFloat(getComputedStyle(search).fontSize)>=16,'search has no iOS focus zoom trigger');
    search.value='риски';search.dispatchEvent(new Event('input'));
    const link=document.querySelector('#toc a[href="#t-10-9"]');
    assert(!link.closest('li').classList.contains('hidden'),'search finds GenAI topic');
    link.click();await until(()=>main.scrollTop>10000,"navigation frame");await wait();
    assert(!main.inert&&menu.inert,'menu closes after navigation');
    assert(main.scrollTop>10000&&window.scrollY===0,'navigation scrolls reader only: '+main.scrollTop+' / '+window.scrollY);
    const topic=document.getElementById('t-10-9');
    assert(Math.abs(topic.getBoundingClientRect().top-main.getBoundingClientRect().top-16)<3,'anchor positioned below header');
    const h=topic.querySelector('h3'), studied=topic.querySelector('.studied');
    assert(h.getBoundingClientRect().bottom<studied.getBoundingClientRect().top,'heading and studied control are stacked');
    const cb=topic.querySelector('.studied-chk');cb.checked=true;cb.dispatchEvent(new Event('change'));
    assert(topic.classList.contains('done')&&document.getElementById('progressLabel').textContent.startsWith('1 /'),'progress updates');
    const check=topic.querySelector('input.chk');check.checked=true;check.dispatchEvent(new Event('change'));
    const detail=topic.querySelector('details');detail.querySelector('summary').click();await wait();
    assert(detail.open,'answer expands');
    detail.querySelector('summary').click();await wait();assert(!detail.open,'answer collapses');
    detail.querySelector('summary').click();await wait();
    document.querySelector('[data-f="head"]').click();await wait();
    assert(document.body.dataset.filter==='head','filter selected');
    assert(Array.from(topic.querySelectorAll('[data-level]')).filter(e=>!e.dataset.level.split(' ').includes('head')).every(e=>getComputedStyle(e).display==='none'),'other levels hidden');
    document.querySelector('[data-f="all"]').click();await wait();
    const table=document.querySelector('.tbl-wrap');
    assert(table.scrollWidth>table.clientWidth,'table has horizontal scroll area');
    table.scrollLeft=100;assert(table.scrollLeft>0,'table scrolls horizontally');
    document.getElementById('themeBtn').click();
    assert(document.documentElement.dataset.theme==='dark','dark mode toggles');
    main.scrollTop+=340;await wait();const expected=main.scrollTop;
    await wait();assert(Math.abs(main.scrollTop-expected)<2,'reading position does not jump');
    window.bookSavePosition();
    const reading=JSON.parse(localStorage.getItem('ya-reading'));
    assert(reading.id==='t-10-9'&&reading.offset>200,'position persisted within topic');
    window.webkit.messageHandlers.result.postMessage({ok:true,checks});
  }catch(e){window.webkit.messageHandlers.result.postMessage({ok:false,error:String(e),checks});}
})();
