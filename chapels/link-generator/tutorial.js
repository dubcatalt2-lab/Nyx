(()=>{
  const key='nyx.linkGenerator.walkthrough.v1';
  const steps=[
    [['.access-tabs','Start with your Nyx account','Sign in below, or use your Premium access code. Then select Continue. Nothing is published yet.']],
    [['[data-provider]','Choose where to host it','jsDelivr uses the Nyx publisher. Other configured providers appear here when available.'],
     ['[data-label-input]','Give it a name','Choose a short label, such as study-room. A random suffix keeps each new link separate.'],
     ['[data-filter-select]','Check your network','Select a filter for a one-time availability report. A report cannot guarantee a link will work on every network.'],
     ['[data-wizard-step="1"] .wizard-actions','Review before publishing','Choose the amount if shown, then select Review. Surge creates one link at a time.']],
    [['.review-panel','Check these details','Review the destination and provider, tick the confirmation, then select Generate link once. Wait for it to finish.']],
    [['.bulk-link-actions','Your link is ready','Copy it, download the list, or open it. The report below shows what the selected filter returned.']]
  ];
  let active=true,step=0,index=0,ack=[],previous=null;
  try{const saved=JSON.parse(localStorage.getItem(key)||'null');active=!saved?.done;ack=saved?.ack||[];}catch{}
  const ring=document.createElement('div');ring.className='generator-tour-ring';ring.hidden=true;ring.setAttribute('aria-hidden','true');
  const panel=document.createElement('section');panel.className='generator-tour';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-labelledby','generator-tour-title');panel.tabIndex=-1;
  panel.innerHTML='<small data-tour-count></small><h3 id="generator-tour-title"></h3><p data-tour-copy></p><div><button type="button" data-tour-skip>Skip tutorial</button><button type="button" data-tour-next>Got it</button></div>';
  document.body.append(ring,panel);
  const save=done=>{try{localStorage.setItem(key,JSON.stringify({done,ack}));}catch{}};
  function hide(){ring.hidden=true;panel.hidden=true;if(panel.contains(document.activeElement)&&previous?.isConnected)previous.focus({preventScroll:true});}
  function place(){
    if(panel.hidden)return;
    const target=document.querySelector(steps[step]?.[index]?.[0]);
    if(!target||!target.getClientRects().length){hide();return;}
    const r=target.getBoundingClientRect();
    Object.assign(ring.style,{left:`${r.left-5}px`,top:`${r.top-5}px`,width:`${r.width+10}px`,height:`${r.height+10}px`});
    const width=panel.offsetWidth,height=panel.offsetHeight;
    const below=r.bottom+18;
    const top=below+height<innerHeight-12?below:Math.max(12,r.top-height-18);
    Object.assign(panel.style,{left:`${Math.max(12,Math.min(innerWidth-width-12,r.left))}px`,top:`${Math.min(top,Math.max(12,innerHeight-height-12))}px`});
  }
  function show(){
    if(!active||ack.includes(step)){hide();return;}
    const [selector,title,copy]=steps[step][index];
    const target=document.querySelector(selector);
    if(!target)return;
    if(!panel.contains(document.activeElement))previous=document.activeElement;
    target.scrollIntoView({block:'center',behavior:'instant'});
    panel.querySelector('h3').textContent=title;
    panel.querySelector('[data-tour-copy]').textContent=copy;
    panel.querySelector('[data-tour-count]').textContent=`${['Access','Details','Review','Done'][step]} · ${index+1} / ${steps[step].length}`;
    panel.querySelector('[data-tour-next]').textContent=index<steps[step].length-1?'Next tip':step===3?'Finish':'Got it';
    panel.hidden=false;ring.hidden=false;place();
  }
  panel.querySelector('[data-tour-next]').addEventListener('click',()=>{
    if(++index<steps[step].length){show();panel.querySelector('[data-tour-next]').focus();return;}
    ack.push(step);if(step===3)active=false;save(!active);hide();
  });
  panel.querySelector('[data-tour-skip]').addEventListener('click',()=>{active=false;save(true);hide();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){active=false;save(true);hide();}});
  document.addEventListener('nyx-generator-step',event=>{step=event.detail;index=0;hide();requestAnimationFrame(show);});
  document.querySelector('[data-tutorial-replay]').addEventListener('click',()=>{active=true;ack=[];index=0;save(false);show();panel.focus();});
  addEventListener('resize',place);addEventListener('scroll',place,true);
})();
