(()=>{
  'use strict';
  const LINK_CHECKER_API='https://getuwu.christmas/api/v1';
  const SESSION_KEY='nyx.linkGenerator.firebaseSession';
  const $=selector=>document.querySelector(selector);
  const refs={
    form:$('[data-generator-form]'),label:$('[data-label-input]'),filter:$('[data-filter-select]'),accessCode:$('[data-access-code]'),
    button:$('[data-generate-button]'),status:$('[data-service-status]'),origin:$('[data-origin]'),notice:$('[data-notice]'),
    resultCard:$('[data-result-card]'),resultUrl:$('[data-result-url]'),copy:$('[data-copy]'),open:$('[data-open]'),
    filterCheck:$('[data-filter-check]'),filterCheckLabel:$('[data-filter-check-label]'),filterCheckState:$('[data-filter-check-state]'),filterCheckDetail:$('[data-filter-check-detail]'),
    modeButtons:[...document.querySelectorAll('[data-access-mode]')],accountPanel:$('[data-account-access]'),administratorPanel:$('[data-administrator-access]'),
    accountFields:$('[data-account-fields]'),email:$('[data-account-email]'),password:$('[data-account-password]'),accountStatus:$('[data-account-status]'),
    signIn:$('[data-account-sign-in]'),createAccount:$('[data-account-create]'),refreshAccount:$('[data-account-refresh]'),signOut:$('[data-account-sign-out]'),
    wizardCard:$('[data-wizard-card]'),wizardSteps:[...document.querySelectorAll('[data-wizard-step]')],wizardIndicators:[...document.querySelectorAll('[data-wizard-indicator]')],
    wizardProgress:$('[data-wizard-progress]'),wizardNext:[...document.querySelectorAll('[data-wizard-next]')],wizardBack:[...document.querySelectorAll('[data-wizard-back]')],wizardRestart:$('[data-wizard-restart]'),
    reviewAccess:$('[data-review-access]'),reviewLabel:$('[data-review-label]'),reviewFilter:$('[data-review-filter]'),reviewOrigin:$('[data-review-origin]'),confirm:$('[data-confirm]')
  };
  let accessMode='account';
  let wizardStep=0;
  let authConfig={enabled:false,apiKey:''};
  let authSession=readStoredSession();

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
    refs.button.querySelector('span').textContent=loading ? 'Creating...' : 'Generate link';
  }
  function setAuthBusy(busy){
    [refs.signIn,refs.createAccount,refs.refreshAccount,refs.signOut].forEach(button=>{button.disabled=busy});
  }
  async function readJson(response){
    let body={};
    try{body=await response.json()}catch{}
    if(!response.ok) throw new Error(body.error || body.message || `Request failed (${response.status})`);
    return body;
  }
  function readStoredSession(){
    try{return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null')}catch{return null}
  }
  function storeSession(session){
    authSession=session;
    try{sessionStorage.setItem(SESSION_KEY,JSON.stringify(session))}catch{}
    renderAccount();
    return session;
  }
  function clearSession(){
    authSession=null;
    try{sessionStorage.removeItem(SESSION_KEY)}catch{}
    renderAccount();
  }
  function friendlyFirebaseError(error){
    const message=String(error?.message || error || 'Authentication failed.').replace(/^Firebase:\s*/i,'');
    const labels={EMAIL_EXISTS:'That email already has an account.',EMAIL_NOT_FOUND:'Email or password is incorrect.',INVALID_PASSWORD:'Email or password is incorrect.',INVALID_LOGIN_CREDENTIALS:'Email or password is incorrect.',WEAK_PASSWORD:'Choose a stronger password.',TOO_MANY_ATTEMPTS_TRY_LATER:'Too many attempts. Try again later.',USER_DISABLED:'This account has been disabled.'};
    return labels[message] || message.replaceAll('_',' ').toLowerCase().replace(/^./,char=>char.toUpperCase());
  }
  async function firebaseRequest(service,path,body,form=false){
    if(!authConfig.enabled || !authConfig.apiKey) throw new Error('Free account access is not configured yet.');
    const base=service==='token' ? 'https://securetoken.googleapis.com/v1' : 'https://identitytoolkit.googleapis.com/v1';
    const response=await fetch(`${base}/${path}?key=${encodeURIComponent(authConfig.apiKey)}`,{
      method:'POST',headers:{'Content-Type':form ? 'application/x-www-form-urlencoded' : 'application/json'},body:form ? new URLSearchParams(body) : JSON.stringify(body)
    });
    let payload={};
    try{payload=await response.json()}catch{}
    if(!response.ok) throw new Error(payload?.error?.message || `Authentication failed (${response.status})`);
    return payload;
  }
  function sessionFromResponse(result,existing={}){
    return {
      idToken:result.idToken || result.id_token,
      refreshToken:result.refreshToken || result.refresh_token || existing.refreshToken,
      expiresAt:Date.now() + (Number(result.expiresIn || result.expires_in || 3600)*1000),
      email:result.email || existing.email || '',
      emailVerified:Boolean(existing.emailVerified)
    };
  }
  async function lookupAccount(idToken){
    const result=await firebaseRequest('identity','accounts:lookup',{idToken});
    const user=result.users?.[0];
    return {email:user?.email || '',emailVerified:Boolean(user?.emailVerified)};
  }
  async function refreshSession(){
    if(!authSession?.refreshToken) throw new Error('Sign in again.');
    const result=await firebaseRequest('token','token',{grant_type:'refresh_token',refresh_token:authSession.refreshToken},true);
    return storeSession(sessionFromResponse(result,authSession));
  }
  async function refreshVerification(){
    await refreshSession();
    const profile=await lookupAccount(authSession.idToken);
    authSession={...authSession,...profile};
    if(profile.emailVerified){
      await refreshSession();
      authSession.emailVerified=true;
    }
    storeSession(authSession);
    return authSession;
  }
  async function currentVerifiedSession(){
    if(!authSession) throw new Error('Sign in to use your five free links.');
    if(authSession.expiresAt-Date.now()<60_000) await refreshSession();
    if(!authSession.emailVerified) await refreshVerification();
    if(!authSession.emailVerified) throw new Error('Verify your email address, then select “I verified my email.”');
    return authSession;
  }
  function renderAccount(){
    const signedIn=Boolean(authSession?.idToken);
    refs.accountFields.hidden=signedIn;
    refs.signIn.hidden=signedIn;
    refs.createAccount.hidden=signedIn;
    refs.signOut.hidden=!signedIn;
    refs.refreshAccount.hidden=!signedIn || Boolean(authSession?.emailVerified);
    refs.accountStatus.className=`account-status${signedIn ? (authSession.emailVerified ? ' good' : '') : ''}`;
    refs.accountStatus.textContent=signedIn
      ? (authSession.emailVerified ? `${authSession.email || 'Account'} is verified. You can create up to 5 links today.` : `Verification sent to ${authSession.email || 'your email'}. Verify it before generating links.`)
      : 'Sign in with a verified email to receive 5 free links per day.';
  }
  function setAccessMode(mode){
    accessMode=mode;
    refs.accountPanel.hidden=mode!=='account';
    refs.administratorPanel.hidden=mode!=='administrator';
    refs.modeButtons.forEach(button=>{
      const active=button.dataset.accessMode===mode;
      button.classList.toggle('active',active);
      button.setAttribute('aria-selected',String(active));
    });
  }
  function setWizardStep(nextStep,direction=nextStep>=wizardStep?'forward':'back'){
    const index=Math.max(0,Math.min(refs.wizardSteps.length-1,Number(nextStep) || 0));
    wizardStep=index;
    refs.wizardCard.classList.remove('wizard-forward','wizard-back');
    void refs.wizardCard.offsetWidth;
    refs.wizardCard.classList.add(direction==='back' ? 'wizard-back' : 'wizard-forward');
    refs.wizardSteps.forEach((step,stepIndex)=>{
      const active=stepIndex===index;
      step.hidden=!active;
      step.classList.toggle('active',active);
    });
    refs.form.hidden=index===3;
    refs.wizardIndicators.forEach((indicator,stepIndex)=>{
      indicator.classList.toggle('active',stepIndex===index);
      indicator.classList.toggle('complete',stepIndex<index);
      if(stepIndex===index) indicator.setAttribute('aria-current','step');
      else indicator.removeAttribute('aria-current');
    });
    refs.wizardProgress.style.width=`${(index/(refs.wizardSteps.length-1))*100}%`;
  }
  function updateReview(){
    refs.reviewAccess.textContent=accessMode==='account' ? (authSession?.email || 'Free account') : 'Premium users';
    refs.reviewLabel.textContent=refs.label.value.trim() || 'Automatic';
    refs.reviewFilter.textContent=refs.filter.options[refs.filter.selectedIndex]?.textContent || 'Not selected';
    refs.reviewOrigin.textContent=refs.origin.textContent || 'Official Nyx origin';
  }
  async function validateAccessStep(){
    showNotice('');
    if(accessMode==='administrator'){
      if(!refs.accessCode.value){showNotice('Enter your Premium access code to continue.','error');refs.accessCode.focus();return false}
      return true;
    }
    if(!authConfig.enabled){showNotice('Free account access is not configured yet. Choose Premium users to continue.','error');return false}
    if(!authSession?.idToken){showNotice('Sign in or create a verified free account before continuing.','error');refs.email.focus();return false}
    try{await currentVerifiedSession();renderAccount();return true}
    catch(error){showNotice(friendlyFirebaseError(error),'error');return false}
  }
  async function handleWizardNext(){
    if(wizardStep===0){
      if(!await validateAccessStep()) return;
      showNotice('');setWizardStep(1);return;
    }
    if(wizardStep===1){
      if(!refs.filter.value){showNotice('Choose a content filter before continuing.','error');refs.filter.focus();return}
      showNotice('');updateReview();setWizardStep(2);
    }
  }
  async function loadAuthConfig(){
    try{
      authConfig=await readJson(await fetch('/api/link-generator/auth-config',{headers:{Accept:'application/json'},cache:'no-store'}));
    }catch{authConfig={enabled:false,apiKey:''}}
    const accountButton=refs.modeButtons.find(button=>button.dataset.accessMode==='account');
    accountButton.disabled=!authConfig.enabled;
    if(!authConfig.enabled) setAccessMode('administrator');
    renderAccount();
  }
  async function handleSignIn(){
    const email=refs.email.value.trim(),password=refs.password.value;
    if(!email || !password){refs.accountStatus.textContent='Enter your email and password.';refs.accountStatus.className='account-status error';return}
    setAuthBusy(true);
    try{
      const result=await firebaseRequest('identity','accounts:signInWithPassword',{email,password,returnSecureToken:true});
      storeSession(sessionFromResponse(result));
      const profile=await lookupAccount(authSession.idToken);
      storeSession({...authSession,...profile});
      refs.password.value='';
    }catch(error){refs.accountStatus.textContent=friendlyFirebaseError(error);refs.accountStatus.className='account-status error'}
    finally{setAuthBusy(false)}
  }
  async function handleCreateAccount(){
    const email=refs.email.value.trim(),password=refs.password.value;
    if(!email || password.length<6){refs.accountStatus.textContent='Enter an email and a password with at least 6 characters.';refs.accountStatus.className='account-status error';return}
    setAuthBusy(true);
    try{
      const result=await firebaseRequest('identity','accounts:signUp',{email,password,returnSecureToken:true});
      storeSession(sessionFromResponse(result,{email,emailVerified:false}));
      await firebaseRequest('identity','accounts:sendOobCode',{requestType:'VERIFY_EMAIL',idToken:authSession.idToken});
      refs.password.value='';
      renderAccount();
    }catch(error){refs.accountStatus.textContent=friendlyFirebaseError(error);refs.accountStatus.className='account-status error'}
    finally{setAuthBusy(false)}
  }

  function filterLabel(item){
    const key=String(item?.key || item?.filter || '').toLowerCase();
    const label=String(item?.label || item?.filter || item?.key || 'Content filter');
    return key==='cisco' || /^cisco talos$/i.test(label) ? 'Cisco Umbrella' : label;
  }
  async function loadFilters(){
    try{
      const response=await readJson(await fetch(`${LINK_CHECKER_API}/filters`,{headers:{Accept:'application/json'},cache:'no-store'}));
      const filters=Array.isArray(response) ? response : response.filters;
      if(!Array.isArray(filters) || !filters.length) throw new Error('No filters are currently available.');
      refs.filter.textContent='';
      const prompt=document.createElement('option');prompt.value='';prompt.textContent='Choose a content filter';refs.filter.append(prompt);
      filters.forEach(item=>{if(!item?.key)return;const option=document.createElement('option');option.value=String(item.key);option.textContent=filterLabel(item);refs.filter.append(option)});
      refs.filter.disabled=false;
    }catch(error){refs.filter.innerHTML='<option value="">Filter list unavailable</option>';refs.filter.disabled=true;showNotice(`Could not load the content filters: ${error.message}`,'error')}
  }
  function showFilterResult(kind,label,state,detail){refs.filterCheck.className=`filter-check ${kind}`;refs.filterCheckLabel.textContent=label;refs.filterCheckState.textContent=state;refs.filterCheckDetail.textContent=detail}
  async function checkGeneratedLink(url,filterKey,filterName){
    showFilterResult('checking',filterName,'Checking...','Nyx is checking this newly generated link once.');
    try{
      const endpoint=new URL(`${LINK_CHECKER_API}/check`);endpoint.searchParams.set('url',url);endpoint.searchParams.set('filter',filterKey);
      const report=await readJson(await fetch(endpoint,{headers:{Accept:'application/json'},cache:'no-store'}));
      const result=Array.isArray(report?.results) ? report.results[0] : report?.result || report;
      if(result?.error || result?.ok===false) showFilterResult('error',filterName,'Check failed',String(result?.error || 'The filter did not return a usable result.'));
      else if(result?.blocked===true) showFilterResult('blocked',filterName,'Blocked','Sorry, but that link is currently blocked.');
      else if(result?.blocked===false) showFilterResult('allowed',filterName,'Allowed','The selected filter currently reports this link as allowed.');
      else showFilterResult('info',filterName,'Informational','The selected filter did not provide a blocked or allowed decision.');
    }catch(error){showFilterResult('error',filterName,'Check failed',`The link was created, but Nyx could not check it: ${error.message}`)}
  }
  async function loadStatus(){
    try{
      const status=await readJson(await fetch('/api/link-generator/status',{headers:{Accept:'application/json'},cache:'no-store'}));
      refs.origin.textContent=status.origin || 'Not configured';setStatus(status.available,status.available ? 'Ready' : 'Setup required');
      if(!status.available) showNotice('The Nyx administrator still needs to finish the Link Generator environment settings in Netlify.','error');
    }catch(error){refs.origin.textContent='Unavailable';setStatus(false,'Unavailable');showNotice(`Could not check the generator: ${error.message}`,'error')}
  }

  refs.modeButtons.forEach(button=>button.addEventListener('click',()=>setAccessMode(button.dataset.accessMode)));
  refs.wizardNext.forEach(button=>button.addEventListener('click',handleWizardNext));
  refs.wizardBack.forEach(button=>button.addEventListener('click',()=>{showNotice('');setWizardStep(wizardStep-1,'back')}));
  refs.wizardRestart.addEventListener('click',()=>{
    refs.label.value='';refs.filter.value='';refs.confirm.checked=false;refs.resultCard.hidden=true;showNotice('');setWizardStep(1,'back');
  });
  refs.signIn.addEventListener('click',handleSignIn);
  refs.createAccount.addEventListener('click',handleCreateAccount);
  refs.refreshAccount.addEventListener('click',async()=>{setAuthBusy(true);try{await refreshVerification();if(!authSession.emailVerified)throw new Error('Email is not verified yet.')}catch(error){refs.accountStatus.textContent=friendlyFirebaseError(error);refs.accountStatus.className='account-status error'}finally{setAuthBusy(false)}});
  refs.signOut.addEventListener('click',clearSession);
  refs.form.addEventListener('submit',async event=>{
    event.preventDefault();
    if(!refs.filter.value){showNotice('Choose a content filter before generating the link.','error');refs.filter.focus();return}
    const selectedFilter=refs.filter.value;
    const selectedFilterName=refs.filter.options[refs.filter.selectedIndex]?.textContent || selectedFilter;
    showNotice('');refs.resultCard.hidden=true;setLoading(true);
    try{
      const headers={Accept:'application/json','Content-Type':'application/json'};
      const body={label:refs.label.value};
      if(accessMode==='account'){
        const session=await currentVerifiedSession();
        headers.Authorization=`Bearer ${session.idToken}`;
      }else{
        if(!refs.accessCode.value) throw new Error('Enter your Premium access code.');
        body.accessCode=refs.accessCode.value;
      }
      const result=await readJson(await fetch('/api/link-generator',{method:'POST',headers,body:JSON.stringify(body)}));
      refs.resultUrl.value=result.url;refs.open.href=result.url;refs.resultCard.hidden=false;refs.accessCode.value='';setWizardStep(3);requestAnimationFrame(()=>refs.resultCard.scrollIntoView({behavior:'smooth',block:'nearest'}));
      await checkGeneratedLink(result.url,selectedFilter,selectedFilterName);
      showNotice(result.access==='account' ? `The link was created. ${result.remaining} free link${result.remaining===1?'':'s'} remaining today.` : 'The link was created with Premium access.');
    }catch(error){showNotice(error.message,'error')}
    finally{setLoading(false)}
  });
  refs.copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(refs.resultUrl.value);refs.copy.textContent='Copied';setTimeout(()=>{refs.copy.textContent='Copy'},1400)}catch{refs.resultUrl.select();document.execCommand('copy')}});

  applyTheme();renderAccount();setWizardStep(0);Promise.all([loadStatus(),loadAuthConfig(),loadFilters()]);
})();
