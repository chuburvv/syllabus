(async function(){
  try{
    await new Promise(r=>setTimeout(r,400));
    const main=document.querySelector('main'),topic=document.getElementById('t-10-9');
    const saved=JSON.parse(window.__nativeState['ya-reading']);
    let offset=main.getBoundingClientRect().top-topic.getBoundingClientRect().top;
    const deadline=Date.now()+5000;
    while(Math.abs(offset-saved.offset)>3 && Date.now()<deadline){
      await new Promise(r=>setTimeout(r,100));
      offset=main.getBoundingClientRect().top-topic.getBoundingClientRect().top;
    }
    if(Math.abs(offset-saved.offset)>3)throw Error('position not restored: '+offset+' / '+saved.offset);
    if(!topic.querySelector('.studied-chk').checked)throw Error('studied state lost');
    if(!topic.querySelector('input.chk').checked)throw Error('checklist state lost');
    if(!topic.querySelector('details').open)throw Error('answer expansion lost');
    if(document.documentElement.dataset.theme!=='dark')throw Error('theme lost');
    window.webkit.messageHandlers.result.postMessage({ok:true,restoredOffset:offset,checks:['reading position','studied','checklist','expanded answer','theme']});
  }catch(e){window.webkit.messageHandlers.result.postMessage({ok:false,error:String(e)});}
})();
