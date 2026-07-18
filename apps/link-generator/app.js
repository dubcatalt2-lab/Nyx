(()=>{
  'use strict';
  const $=selector=>document.querySelector(selector);
  const refs={
    form:$('[data-generator-form]'),
    label:$('[data-label-input]'),
    accessCode:$('[data-access-code]'),
    button:$('[data-generate-button]'),
    status:$('[data-service-status]'),
    origin:$('[data-origin]'),
    notice:$('[data-notice]'),
    resultCard:$('[data-result-card]'),
    resultUrl:$('[data-result-url]'),
    copy:$('[data-copy]'),
    open:$('[data-open]')
  };

  function applyTheme(){
    let theme='default';
    try{theme=localStorage.getItem('nyx.theme') || 'default'}catch{}
    if(theme && theme!=='default') document.body.classList.add(`theme-${theme}`);
  }

  function showNotice(message,type=''){
    refs.notice.textContent=message;
    refs.notice.className=`notice${type ? ` ${type}` : ''}`;
    refs.notice.hidden=!message;
  }

  function setStatus(online,label){
    refs.status.classList.toggle('online',online);
    refs.status.classList.toggle('offline',!online);
    refs.status.querySelector('span').textContent=label;
  }

  function setLoading(loading){
    refs.button.disabled=loading;
    refs.button.querySelector('span').textContent=loading ? 'Creating…' : 'Generate link';
  }

  async function readJson(response){
    let body={};
    try{body=await response.json()}catch{}
    if(!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
    return body;
  }

  async function loadStatus(){
    try{
      const status=await readJson(await fetch('/api/link-generator/status',{headers:{Accept:'application/json'},cache:'no-store'}));
      refs.origin.textContent=status.origin || 'Not configured';
      setStatus(status.available,status.available ? 'Ready' : 'Setup required');
      if(!status.available) showNotice('The Nyx administrator still needs to add the Bunny API key and generator access code in Netlify.','error');
    }catch(error){
      refs.origin.textContent='Unavailable';
      setStatus(false,'Unavailable');
      showNotice(`Could not check the generator: ${error.message}`,'error');
    }
  }

  refs.form.addEventListener('submit',async event=>{
    event.preventDefault();
    showNotice('');
    refs.resultCard.hidden=true;
    setLoading(true);
    try{
      const result=await readJson(await fetch('/api/link-generator',{
        method:'POST',
        headers:{Accept:'application/json','Content-Type':'application/json'},
        body:JSON.stringify({label:refs.label.value,accessCode:refs.accessCode.value})
      }));
      refs.resultUrl.value=result.url;
      refs.open.href=result.url;
      refs.resultCard.hidden=false;
      refs.accessCode.value='';
      refs.resultCard.scrollIntoView({behavior:'smooth',block:'nearest'});
      showNotice('The pull zone was created successfully.');
    }catch(error){
      showNotice(error.message,'error');
    }finally{
      setLoading(false);
    }
  });

  refs.copy.addEventListener('click',async()=>{
    try{
      await navigator.clipboard.writeText(refs.resultUrl.value);
      refs.copy.textContent='Copied';
      setTimeout(()=>{refs.copy.textContent='Copy'},1400);
    }catch{
      refs.resultUrl.select();
      document.execCommand('copy');
    }
  });

  applyTheme();
  loadStatus();
})();
