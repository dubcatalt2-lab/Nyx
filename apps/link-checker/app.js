(()=>{
  'use strict';
  const CHECK_API='/api/link-checker';
  const HISTORY_KEY='nyx.linkChecker.history.v1';
  const SETTINGS_KEY='nyx.linkChecker.settings.v1';
  const FREEDNS_KEY='nyx.linkChecker.freedns.v1';
  const FREEDNS_VERDICTS_KEY='nyx.linkChecker.freednsVerdicts.v1';
  const HISTORY_LIMIT=500;
  const FREEDNS_PAGE_SIZE=25;
  const FREEDNS_SCAN_CONCURRENCY=2;
  const THEME_CLASSES=['theme-default','theme-ruby','theme-emerald','theme-sakura','theme-fresh'];
  const $=selector=>document.querySelector(selector);
  const $$=selector=>[...document.querySelectorAll(selector)];
  const refs={
    form:$('[data-check-form]'),input:$('[data-url-input]'),filter:$('[data-filter-select]'),button:$('[data-check-button]'),
    apiStatus:$('[data-api-status]'),notice:$('[data-notice]'),resultsSection:$('[data-results-section]'),resultsTitle:$('[data-results-title]'),
    resultList:$('[data-result-list]'),
    domainSection:$('[data-domain-section]'),domainTitle:$('[data-domain-title]'),domainSource:$('[data-domain-source]'),domainDetails:$('[data-domain-details]'),
    dashboardList:$('[data-dashboard-list]'),dashboardEmpty:$('[data-dashboard-empty]'),dashboardPager:$('[data-dashboard-pager]'),
    historyList:$('[data-history-list]'),historyEmpty:$('[data-history-empty]'),
    freednsStart:$('[data-freedns-start]'),freednsCheckAll:$('[data-freedns-check-all]'),freednsCheckPage:$('[data-freedns-check-page]'),freednsStop:$('[data-freedns-stop]'),freednsList:$('[data-freedns-list]'),freednsEmpty:$('[data-freedns-empty]'),freednsPager:$('[data-freedns-pager]'),
    freednsSearch:$('[data-freedns-search]'),freednsStatus:$('[data-freedns-status]'),freednsVendor:$('[data-freedns-vendor]'),freednsProgress:$('[data-freedns-progress]')
  };
  const defaultSettings={pageSize:25,notifications:true,theme:'inherit'};
  let settings=readJsonStorage(SETTINGS_KEY,defaultSettings);
  let history=readJsonStorage(HISTORY_KEY,[]);
  if(!Array.isArray(history)) history=[];
  let vendors=[];
  let activeController=null;
  let lastReport=null;
  let currentTarget='';
  let dashboardPage=1;
  let dashboardVerdict='';
  let freednsCache=readJsonStorage(FREEDNS_KEY,{domains:[],totalPages:0,totalDomains:0,lastScrapedAt:'',complete:false});
  if(!freednsCache||!Array.isArray(freednsCache.domains))freednsCache={domains:[],totalPages:0,totalDomains:0,lastScrapedAt:'',complete:false};
  let freednsPage=1;
  let freednsController=null;
  let freednsScraping=false;
  let freednsScanController=null;
  let freednsPageScanning=false;
  let freednsFullScanning=false;
  let freednsAutoScanStarted=false;
  let freednsBulkAuthPromise=null;
  let freednsVisibleDomains=new Set();
  let freednsVerdicts=readJsonStorage(FREEDNS_VERDICTS_KEY,{vendors:[],verdicts:{},updatedAt:''});
  if(!freednsVerdicts||!Array.isArray(freednsVerdicts.vendors)||!freednsVerdicts.verdicts||typeof freednsVerdicts.verdicts!=='object')freednsVerdicts={vendors:[],verdicts:{},updatedAt:''};
  const freednsChecking=new Set();

  function readJsonStorage(key,fallback){
    try{const value=JSON.parse(localStorage.getItem(key)||'null');return value===null ? fallback : value}catch{return fallback}
  }
  function writeJsonStorage(key,value){
    try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}
  }
  function inheritedTheme(){
    try{return localStorage.getItem('nyx.theme') || 'default'}catch{return 'default'}
  }
  function applyTheme(){
    document.body.classList.remove(...THEME_CLASSES);
    const selected=settings.theme==='inherit' ? inheritedTheme() : settings.theme;
    if(selected && selected!=='default') document.body.classList.add(`theme-${selected}`);
  }
  function normalizeTarget(value){
    const raw=String(value||'').trim();
    if(!raw) throw new Error('Enter a website to check.');
    const candidate=/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
    let parsed;
    try{parsed=new URL(candidate)}catch{throw new Error('Enter a valid website or URL.');}
    if(!['http:','https:'].includes(parsed.protocol)) throw new Error('Only HTTP and HTTPS links can be checked.');
    parsed.hash='';
    return parsed.href;
  }
  function showNotice(message,type='',force=false){
    if(!message){refs.notice.textContent='';refs.notice.hidden=true;return;}
    if(!force && type!=='error' && !settings.notifications) return;
    refs.notice.textContent=message;
    refs.notice.className=`notice global-notice${type ? ` ${type}` : ''}`;
    refs.notice.hidden=!message;
  }
  function makeIcon(name){
    const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
    const use=document.createElementNS('http://www.w3.org/2000/svg','use');
    icon.setAttribute('class','lc-icon');icon.setAttribute('aria-hidden','true');use.setAttribute('href',`#icon-${name}`);icon.append(use);return icon;
  }
  function setLoading(loading){
    document.body.classList.toggle('loading',loading);
    refs.button.disabled=loading;
    refs.button.querySelector('span').textContent=loading ? 'Checking...' : 'Check';
  }
  function setApiStatus(online,label=online?'API online':'API unavailable'){
    refs.apiStatus.classList.toggle('online',online);
    refs.apiStatus.classList.toggle('offline',!online);
    refs.apiStatus.querySelector('span').textContent=label;
  }
  function vendorLabel(value){
    const key=String(typeof value==='string' ? value : (value?.filter||value?.key||'')).trim().toLowerCase();
    const supplied=String(typeof value==='string' ? value : (value?.label||value?.filter||value?.key||'Filter'));
    const labels={blocksi_ai:'Blocksi AI',cisco:'Cisco Umbrella',dnsfilter:'DNSFilter',fortiguard:'FortiGuard',goguardian:'GoGuardian',iboss:'iBoss',lanschool:'LanSchool',paloalto:'Palo Alto'};
    if(labels[key]) return labels[key];
    if(/^cisco talos$/i.test(supplied)) return 'Cisco Umbrella';
    return supplied===key ? key.replace(/_/g,' ').replace(/\b\w/g,letter=>letter.toUpperCase()) : supplied;
  }
  async function fetchJson(url,options={}){
    const response=await fetch(url,{...options,headers:{Accept:'application/json',...(options.headers||{})}});
    if(!response.ok){
      let message=`Request failed (${response.status})`;
      try{const body=await response.json();message=body.error||body.message||message}catch{}
      const error=new Error(message);error.status=response.status;throw error;
    }
    return response.json();
  }
  async function loadVendors(){
    try{
      const payload=await fetchJson(`${CHECK_API}/vendors`);
      vendors=(Array.isArray(payload)?payload:payload.vendors||[]).map(String).filter(Boolean);
      $$('[data-vendor-select]').forEach(select=>{
        const current=select.value;
        const first=select.options[0];
        select.replaceChildren(first);
        vendors.forEach(key=>{
          const option=document.createElement('option');option.value=key;option.textContent=vendorLabel(key);select.append(option);
        });
        if([...select.options].some(option=>option.value===current)) select.value=current;
      });
      $('[data-stat-vendors]').textContent=String(vendors.length);
      setApiStatus(true,`${vendors.length} vendors ready`);
      renderFreedns();
      void maybeAutoScanFreednsPage();
    }catch(error){setApiStatus(false);showNotice(`Could not load vendor filters: ${error.message}`,'error',true);}
  }
  function normalizeCheckReport(payload,target){
    const values=payload?.vendors&&typeof payload.vendors==='object'?payload.vendors:{};
    const results=Object.entries(values).map(([key,value])=>({
      filter:key,label:vendorLabel(key),blocked:value?.blocked===true?true:(value?.blocked===false?false:null),
      category:String(value?.category||''),error:String(value?.error||''),ms:Number.isFinite(Number(value?.ms))?Number(value.ms):null
    }));
    if(!results.length) throw new Error('The Link Checker returned no vendor results.');
    return {
      target:String(payload?.host||new URL(target).hostname),url:target,blocked:payload?.blocked===true,
      blockedBy:Array.isArray(payload?.blockedBy)?payload.blockedBy.map(String):results.filter(result=>result.blocked===true).map(result=>result.filter),
      cached:payload?.cached===true,plan:String(payload?.plan||''),usage:payload?.usage||null,results
    };
  }
  async function freednsBulkToken(){
    if(!freednsBulkAuthPromise)freednsBulkAuthPromise=(async()=>{
      const config=await fetchJson('/api/founder-profile/auth-config',{cache:'no-store'});
      if(!config?.enabled)throw new Error('Nyx account sign-in is not configured.');
      const [{initializeApp,getApps},{getAuth,setPersistence,browserLocalPersistence}]=await Promise.all([
        import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js')
      ]);
      const app=getApps().find(item=>item.name==='nyx-founder-owner')||initializeApp({apiKey:config.apiKey,authDomain:`${config.projectId}.firebaseapp.com`,projectId:config.projectId},'nyx-founder-owner');
      const auth=getAuth(app);try{await setPersistence(auth,browserLocalPersistence)}catch{}
      if(typeof auth.authStateReady==='function')await auth.authStateReady();
      return auth;
    })();
    const auth=await freednsBulkAuthPromise;
    if(!auth.currentUser)throw new Error('Sign in to Nyx on the homepage before starting a full registry scan.');
    return auth.currentUser.getIdToken();
  }
  async function checkTarget(target,vendor='',signal,{bulk=false}={}){
    const headers={'Content-Type':'application/json'};
    if(bulk)headers.Authorization=`Bearer ${await freednsBulkToken()}`;
    const payload=await fetchJson(`${CHECK_API}/check`,{
      method:'POST',signal,headers,body:JSON.stringify({url:target,...(vendor?{vendor}:{}),...(bulk?{bulk:true}:{})})
    });
    return normalizeCheckReport(payload,target);
  }
  function resultState(result){
    if(result?.error) return {key:'error',label:'Error'};
    if(result?.blocked===true) return {key:'blocked',label:'Blocked'};
    if(result?.blocked===false) return {key:'allowed',label:'Allowed'};
    return {key:'info',label:'Unknown'};
  }
  function reportCounts(report){
    const counts={blocked:0,allowed:0,info:0,error:0};
    (report?.results||[]).forEach(result=>{counts[resultState(result).key]+=1;});
    return counts;
  }
  function renderResults(report){
    const counts=reportCounts(report);
    refs.resultList.replaceChildren();
    report.results.forEach(result=>{
      const state=resultState(result);
      const row=document.createElement('article');row.className=`result-row ${state.key}`;
      const dot=document.createElement('span');dot.className='result-dot';dot.setAttribute('aria-hidden','true');
      const copy=document.createElement('div');copy.className='result-copy';
      const label=document.createElement('strong');label.textContent=result.label||vendorLabel(result.filter);
      const category=document.createElement('span');category.textContent=result.error||result.category||'No category returned';copy.append(label,category);
      const meta=document.createElement('div');meta.className='result-meta';
      const status=document.createElement('span');status.className='result-state';status.textContent=state.label;
      const timing=document.createElement('span');timing.className='result-time';timing.textContent=Number.isFinite(result.ms)?`${Math.round(result.ms)} ms`:'—';meta.append(status,timing);
      row.append(dot,copy,meta);refs.resultList.append(row);
    });
    Object.entries(counts).forEach(([key,value])=>{const node=$(`[data-count-${key}]`);if(node)node.textContent=String(value);});
    refs.resultsTitle.textContent=`Results for ${report.target}`;
    const summary=$('[data-results-summary]');
    if(summary) summary.textContent=report.blocked
      ? `Blocked by ${report.blockedBy.length} vendor${report.blockedBy.length===1?'':'s'}${report.cached?' · cached result':''}`
      : `Not blocked by any reporting vendor${report.cached?' · cached result':''}`;
    refs.resultsSection.hidden=false;
    lastReport=report;
  }
  function domainDate(events,action){return events.find(event=>event.action===action)?.date||''}
  function formatDate(value){if(!value)return 'Not reported';const date=new Date(value);return Number.isNaN(date.getTime())?String(value):date.toLocaleString()}
  function addDomainDetail(label,value){
    const item=document.createElement('article');const name=document.createElement('span');const copy=document.createElement('strong');
    name.textContent=label;copy.textContent=Array.isArray(value)?(value.join(', ')||'Not reported'):(value||'Not reported');item.append(name,copy);refs.domainDetails.append(item);
  }
  function renderDomainInfo(info){
    refs.domainDetails.replaceChildren();refs.domainTitle.textContent=info.domain||'Domain details';refs.domainSource.textContent=info.source||'RDAP';
    addDomainDetail('Registrar',info.registrar);addDomainDetail('Created',formatDate(domainDate(info.events||[],'registration')));
    addDomainDetail('Updated',formatDate(domainDate(info.events||[],'last changed')));addDomainDetail('Expires',formatDate(domainDate(info.events||[],'expiration')));
    addDomainDetail('Status',info.status);addDomainDetail('DNSSEC',info.dnssec?'Signed':'Not reported as signed');addDomainDetail('Nameservers',info.nameservers);
    refs.domainSection.hidden=false;
  }
  async function loadDomainInfo(target,signal){
    refs.domainSection.hidden=true;
    try{
      const info=await fetchJson(`${CHECK_API}/domain-info`,{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({url:target})});
      renderDomainInfo(info);
    }catch(error){if(error.name==='AbortError')return;}
  }
  function recordReport(report,source='single',render=true){
    const entry={...report,id:globalThis.crypto?.randomUUID?.()||`scan-${Date.now()}-${Math.random().toString(16).slice(2)}`,checkedAt:new Date().toISOString(),source};
    history.unshift(entry);history=history.slice(0,HISTORY_LIMIT);writeJsonStorage(HISTORY_KEY,history);if(render)renderWorkspace();return entry;
  }
  async function runCheck(event){
    event?.preventDefault();let target;
    try{target=normalizeTarget(refs.input.value)}catch(error){showNotice(error.message,'error',true);refs.input.focus();return;}
    activeController?.abort();activeController=new AbortController();currentTarget=target;
    refs.resultsSection.hidden=true;refs.domainSection.hidden=true;showNotice('');setLoading(true);
    try{
      const report=await checkTarget(target,refs.filter.value,activeController.signal);
      renderResults(report);recordReport(report,'single');setApiStatus(true,report.plan?`${vendors.length} vendors · ${report.plan}`:`${vendors.length} vendors ready`);
      void loadDomainInfo(target,activeController.signal);
      refs.resultsSection.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
    }catch(error){if(error.name!=='AbortError'){showNotice(`Check failed: ${error.message}`,'error',true);setApiStatus(false,'Request failed');}}
    finally{setLoading(false);}
  }
  function latestByHost(){
    const map=new Map();history.forEach(entry=>{const key=String(entry.target||'').toLowerCase();if(key&&!map.has(key))map.set(key,entry);});return [...map.values()];
  }
  function verdictFor(entry,vendor=''){
    if(vendor){const result=(entry.results||[]).find(item=>item.filter===vendor);return resultState(result).key;}
    const counts=reportCounts(entry);return counts.blocked?'blocked':(counts.allowed?'allowed':'unknown');
  }
  function filteredDashboardRows(){
    const search=String($('[data-dashboard-search]')?.value||'').trim().toLowerCase();const vendor=$('[data-dashboard-vendor]')?.value||'';const verdict=dashboardVerdict;
    return latestByHost().filter(entry=>{
      if(search&&!`${entry.target} ${entry.url}`.toLowerCase().includes(search))return false;
      if(vendor&&!(entry.results||[]).some(result=>result.filter===vendor))return false;
      return !verdict||verdictFor(entry,vendor)===verdict;
    });
  }
  function makeVerdictPill(entry){
    const verdict=verdictFor(entry);const pill=document.createElement('span');pill.className=`verdict-pill ${verdict}`;pill.textContent=verdict==='blocked'?'Blocked':verdict==='allowed'?'Allowed':'Unknown';return pill;
  }
  function renderDashboard(){
    const unique=latestByHost();$('[data-stat-domains]').textContent=String(unique.length);$('[data-stat-checks]').textContent=String(history.length);
    const blockedCount=unique.filter(entry=>verdictFor(entry)==='blocked').length;
    $('[data-stat-blocked]').textContent=String(blockedCount);$('[data-stat-vendors]').textContent=String(vendors.length);
    const usageBar=$('[data-usage-bar]');if(usageBar)usageBar.style.width=`${unique.length?Math.max(5,Math.round(blockedCount/unique.length*100)):0}%`;
    const rows=filteredDashboardRows();const pageSize=Number(settings.pageSize)||25;const pageCount=Math.max(1,Math.ceil(rows.length/pageSize));dashboardPage=Math.min(Math.max(1,dashboardPage),pageCount);
    const pageRows=rows.slice((dashboardPage-1)*pageSize,dashboardPage*pageSize);refs.dashboardList.replaceChildren();
    pageRows.forEach(entry=>{
      const row=document.createElement('article');row.className='domain-row';
      const identity=document.createElement('div');identity.className='domain-identity';const title=document.createElement('strong');title.textContent=entry.target;const url=document.createElement('span');url.textContent=entry.url||entry.target;identity.append(title,url);
      const time=document.createElement('time');time.dateTime=entry.checkedAt||'';time.textContent=formatDate(entry.checkedAt);
      const pill=makeVerdictPill(entry);const vendorsNode=document.createElement('span');vendorsNode.className='domain-vendor-count';vendorsNode.textContent=String(entry.results?.length||0);
      const open=document.createElement('button');open.className='btn-secondary';open.type='button';open.append(makeIcon('eye'),'Open');open.addEventListener('click',()=>openSavedReport(entry));
      row.append(identity,time,pill,vendorsNode,open);refs.dashboardList.append(row);
    });
    refs.dashboardEmpty.hidden=rows.length>0;refs.dashboardPager.hidden=rows.length<=pageSize;
    $('[data-dashboard-page-label]').textContent=`Page ${dashboardPage} of ${pageCount} · ${rows.length} domains`;
    $('[data-dashboard-prev]').disabled=dashboardPage<=1;$('[data-dashboard-next]').disabled=dashboardPage>=pageCount;
  }
  function renderHistory(){
    refs.historyList.replaceChildren();history.forEach(entry=>{
      const row=document.createElement('article');row.className='history-row';const time=document.createElement('time');time.dateTime=entry.checkedAt||'';time.textContent=formatDate(entry.checkedAt);
      const action=document.createElement('span');action.className='history-action';action.textContent='check';
      const copy=document.createElement('div');const title=document.createElement('strong');title.textContent=entry.target;const detail=document.createElement('span');detail.textContent=entry.url||entry.target;copy.append(title,detail);
      const result=document.createElement('div');result.className='history-result';result.append(makeVerdictPill(entry));const count=document.createElement('span');count.textContent=String(entry.results?.length||0);result.append(count);
      const open=document.createElement('button');open.className='btn-secondary';open.type='button';open.append(makeIcon('eye'),'View');open.addEventListener('click',()=>openSavedReport(entry));row.append(time,action,copy,result,open);refs.historyList.append(row);
    });refs.historyEmpty.hidden=history.length>0;
  }
  function normalizedFreednsDomain(value){
    const domain=String(value?.domain||'').trim().toLowerCase();
    if(!domain||!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(domain))return null;
    return {id:String(value?.id||domain),domain,status:value?.status==='public'?'public':'private',hosts:Math.max(0,Number(value?.hosts)||0)};
  }
  function filteredFreednsDomains(){
    const search=String(refs.freednsSearch?.value||'').trim().toLowerCase();const status=refs.freednsStatus?.value||'all';
    return freednsCache.domains.filter(entry=>(!search||entry.domain.includes(search))&&(status==='all'||entry.status===status));
  }
  function freednsResultsFor(domain){
    const results=new Map();let checkedAt='';
    history.forEach(entry=>{
      if(String(entry?.target||'').trim().toLowerCase()!==domain)return;
      if(!checkedAt)checkedAt=entry.checkedAt||'';
      (entry.results||[]).forEach(result=>{const key=String(result?.filter||'');if(key&&!results.has(key))results.set(key,result);});
    });
    const compact=String(freednsVerdicts.verdicts[domain]||'');
    freednsVerdicts.vendors.forEach((vendor,index)=>{
      if(results.has(vendor))return;
      const state=compact[index];
      if(state==='a')results.set(vendor,{filter:vendor,blocked:false});
      else if(state==='b')results.set(vendor,{filter:vendor,blocked:true});
      else if(state==='e')results.set(vendor,{filter:vendor,blocked:null,error:'Stored vendor error'});
      else if(state==='u')results.set(vendor,{filter:vendor,blocked:null});
    });
    return {results,checkedAt};
  }
  function freednsVendorSignature(values=vendors){return values.map(String).join('\u001f')}
  function storeFreednsVerdict(report,domain=report?.target){
    if(freednsVendorSignature(freednsVerdicts.vendors)!==freednsVendorSignature())freednsVerdicts={vendors:[...vendors],verdicts:{},updatedAt:''};
    const byVendor=new Map((report?.results||[]).map(result=>[String(result?.filter||''),result]));
    freednsVerdicts.verdicts[String(domain||'').toLowerCase()]=vendors.map(vendor=>{
      const result=byVendor.get(vendor);if(!result)return 'u';if(result.error)return 'e';return result.blocked===true?'b':(result.blocked===false?'a':'u');
    }).join('');
    freednsVerdicts.updatedAt=new Date().toISOString();
  }
  function saveFreednsVerdicts(){return writeJsonStorage(FREEDNS_VERDICTS_KEY,freednsVerdicts)}
  function hasStoredFreednsVerdict(domain){
    return freednsVendorSignature(freednsVerdicts.vendors)===freednsVendorSignature()&&String(freednsVerdicts.verdicts[domain]||'').length===vendors.length;
  }
  function makeFreednsVendorStatus(vendor,result){
    const state=result ? resultState(result) : {key:'unchecked',label:'Not checked'};
    const status=document.createElement('span');status.className=`freedns-vendor-icon ${state.key}`;
    status.title=`${vendorLabel(vendor)}: ${state.label}`;status.setAttribute('aria-label',status.title);
    status.append(makeIcon(state.key==='blocked'?'shield-x':state.key==='allowed'?'shield-check':'shield-question'));
    return status;
  }
  function freednsPageState(){
    const domains=filteredFreednsDomains();const pages=Math.max(1,Math.ceil(domains.length/FREEDNS_PAGE_SIZE));freednsPage=Math.min(Math.max(1,freednsPage),pages);
    return {domains,pages,visible:domains.slice((freednsPage-1)*FREEDNS_PAGE_SIZE,freednsPage*FREEDNS_PAGE_SIZE)};
  }
  function updateFreednsActions(){
    const busy=freednsScraping||freednsPageScanning||freednsFullScanning;
    const interactionBusy=freednsScraping||freednsPageScanning;
    refs.freednsStart.disabled=busy;
    refs.freednsStart.querySelector('span').textContent=freednsScraping?'Scraping…':'Scrape registry';
    refs.freednsCheckAll.disabled=busy||!vendors.length||!freednsCache.complete;
    refs.freednsCheckAll.querySelector('span').textContent=freednsFullScanning?'Checking all…':'Check all domains';
    refs.freednsCheckPage.disabled=busy||!vendors.length||!freednsPageState().visible.length;
    refs.freednsCheckPage.querySelector('span').textContent=freednsPageScanning?'Checking…':'Check this page';
    refs.freednsStop.hidden=!busy;
    refs.freednsSearch.disabled=interactionBusy;refs.freednsStatus.disabled=interactionBusy;refs.freednsVendor.disabled=interactionBusy;
    $('[data-freedns-clear]').disabled=busy;
    $('[data-freedns-prev]').disabled=interactionBusy||freednsPage<=1;
    $('[data-freedns-next]').disabled=interactionBusy||freednsPage>=freednsPageState().pages;
  }
  function renderFreedns(){
    const {domains,pages,visible}=freednsPageState();
    freednsVisibleDomains=new Set(visible.map(entry=>entry.domain));
    $('[data-freedns-count]').textContent=freednsCache.domains.length.toLocaleString();
    $('[data-freedns-pages]').textContent=freednsCache.totalPages?String(freednsCache.totalPages):'—';
    $('[data-freedns-public]').textContent=freednsCache.domains.filter(entry=>entry.status==='public').length.toLocaleString();
    $('[data-freedns-private]').textContent=freednsCache.domains.filter(entry=>entry.status==='private').length.toLocaleString();
    $('[data-freedns-updated]').textContent=freednsCache.lastScrapedAt?`${freednsCache.complete?'Updated':'Partial scrape'} ${formatDate(freednsCache.lastScrapedAt)}`:'Not scraped on this device';
    refs.freednsList.replaceChildren();
    visible.forEach(entry=>{
      const row=document.createElement('article');row.className='freedns-row';
      const identity=document.createElement('div');identity.className='freedns-identity';const name=document.createElement('strong');name.textContent=entry.domain;const id=document.createElement('span');id.textContent=`FreeDNS #${entry.id}`;identity.append(name,id);
      const hosts=document.createElement('span');hosts.className='freedns-hosts';hosts.textContent=entry.hosts.toLocaleString();
      const status=document.createElement('span');status.className=`freedns-status ${entry.status}`;status.textContent=entry.status;
      const report=freednsResultsFor(entry.domain);const selectedVendor=refs.freednsVendor?.value||'';const shownVendors=selectedVendor?[selectedVendor]:vendors;
      const vendorStates=document.createElement('div');vendorStates.className='freedns-vendor-states';
      if(!shownVendors.length){const waiting=document.createElement('span');waiting.className='freedns-not-checked';waiting.textContent='vendors loading';vendorStates.append(waiting);}
      else if(!shownVendors.some(vendor=>report.results.has(vendor))){const unchecked=document.createElement('span');unchecked.className='freedns-not-checked';unchecked.textContent='not checked';vendorStates.append(unchecked);}
      else shownVendors.forEach(vendor=>vendorStates.append(makeFreednsVendorStatus(vendor,report.results.get(vendor))));
      if(report.checkedAt)vendorStates.title=`Last checked ${formatDate(report.checkedAt)}`;
      const checking=freednsChecking.has(entry.domain);const check=document.createElement('button');check.className=`btn-secondary freedns-check-button${checking?' checking':''}`;check.type='button';check.disabled=checking||freednsFullScanning||freednsPageScanning||freednsScraping||!vendors.length;check.title=selectedVendor?`Check ${entry.domain} with ${vendorLabel(selectedVendor)}`:`Check ${entry.domain} with all vendors`;check.setAttribute('aria-label',check.title);check.append(makeIcon('refresh'));check.addEventListener('click',()=>void checkFreednsDomain(entry.domain));
      row.append(identity,hosts,status,vendorStates,check);refs.freednsList.append(row);
    });
    refs.freednsEmpty.hidden=domains.length>0;refs.freednsPager.hidden=domains.length<=FREEDNS_PAGE_SIZE;
    $('[data-freedns-page-label]').textContent=`Page ${freednsPage} of ${pages} · ${domains.length.toLocaleString()} domains`;
    $('[data-freedns-prev]').disabled=freednsPage<=1;$('[data-freedns-next]').disabled=freednsPage>=pages;
    updateFreednsActions();
  }
  function setFreednsScraping(active){
    freednsScraping=active;updateFreednsActions();
  }
  function setFreednsProgress(page,total,count){
    const percent=total?Math.min(100,Math.round(page/total*100)):0;refs.freednsProgress.hidden=false;
    $('[data-freedns-progress-label]').textContent=`Scraping page ${page.toLocaleString()} of ${total.toLocaleString()}`;
    $('[data-freedns-progress-count]').textContent=`${percent}% · ${count.toLocaleString()} domains`;
    $('[data-freedns-progress-bar]').style.width=`${percent}%`;
    $('[data-freedns-progress-detail]').textContent='The scrape runs one bounded page at a time so it can finish safely through Netlify.';
  }
  function setFreednsScanProgress(completed,total,failed=0){
    const percent=total?Math.min(100,Math.round(completed/total*100)):0;refs.freednsProgress.hidden=false;
    $('[data-freedns-progress-label]').textContent=completed>=total?`Checked ${total.toLocaleString()} domains`:`Checking domain ${(completed+1).toLocaleString()} of ${total.toLocaleString()}`;
    $('[data-freedns-progress-count]').textContent=`${percent}%${failed?` · ${failed.toLocaleString()} failed`:''}`;
    $('[data-freedns-progress-bar]').style.width=`${percent}%`;
    $('[data-freedns-progress-detail]').textContent='Results are saved on this device as each domain finishes. You can stop without losing completed checks.';
  }
  function setFreednsFullProgress(completed,total,failed=0){
    const percent=total?Math.min(100,Math.round(completed/total*100)):0;refs.freednsProgress.hidden=false;
    $('[data-freedns-progress-label]').textContent=completed>=total?`Checked all ${total.toLocaleString()} domains`:`Full scan: ${completed.toLocaleString()} of ${total.toLocaleString()} domains`;
    $('[data-freedns-progress-count]').textContent=`${percent}%${failed?` · ${failed.toLocaleString()} failed`:''}`;
    $('[data-freedns-progress-bar]').style.width=`${percent}%`;
    $('[data-freedns-progress-detail]').textContent='Keep this tab open. Saved verdicts let a stopped full scan resume without repeating completed domains.';
  }
  function freednsDelay(milliseconds,signal){
    if(signal.aborted)return Promise.reject(new DOMException('Stopped','AbortError'));
    return new Promise((resolve,reject)=>{const timer=setTimeout(resolve,milliseconds);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Stopped','AbortError'));},{once:true});});
  }
  function saveFreednsCache(){return writeJsonStorage(FREEDNS_KEY,freednsCache)}
  async function startFreednsScrape(){
    if(freednsScraping)return;
    freednsAutoScanStarted=false;freednsController?.abort();freednsController=new AbortController();const signal=freednsController.signal;setFreednsScraping(true);showNotice('');
    const collected=new Map();let totalPages=1;let totalDomains=0;let completedPages=0;
    try{
      for(let page=1;page<=totalPages;page+=1){
        const payload=await fetchJson(`${CHECK_API}/freedns-registry?page=${page}`,{signal});
        if(page===1){totalPages=Math.max(1,Math.min(500,Number(payload.totalPages)||1));totalDomains=Math.max(0,Number(payload.totalDomains)||0);}
        (Array.isArray(payload.domains)?payload.domains:[]).forEach(value=>{const entry=normalizedFreednsDomain(value);if(entry)collected.set(entry.id,entry);});
        completedPages=page;setFreednsProgress(page,totalPages,collected.size);
        if(page===1||page%10===0||page===totalPages){freednsCache={domains:[...collected.values()],totalPages,totalDomains,lastScrapedAt:new Date().toISOString(),complete:page===totalPages};renderFreedns();}
        if(page<totalPages)await freednsDelay(175,signal);
      }
      freednsCache={domains:[...collected.values()],totalPages,totalDomains,lastScrapedAt:new Date().toISOString(),complete:true};
      const saved=saveFreednsCache();renderFreedns();showNotice(saved?`FreeDNS scrape complete: ${freednsCache.domains.length.toLocaleString()} domains cached on this device.`:'The scrape completed, but this browser could not save the registry cache.',saved?'':'error',!saved);
    }catch(error){
      if(collected.size){freednsCache={domains:[...collected.values()],totalPages,totalDomains,lastScrapedAt:new Date().toISOString(),complete:false};saveFreednsCache();renderFreedns();}
      if(error.name==='AbortError')showNotice(`FreeDNS scrape stopped after ${completedPages.toLocaleString()} pages. The partial cache was saved.`);
      else showNotice(`FreeDNS scrape failed on page ${(completedPages+1).toLocaleString()}: ${error.message}`,'error',true);
    }finally{setFreednsScraping(false);if(freednsCache.complete)void maybeAutoScanFreednsPage();}
  }
  function stopFreednsWork(){freednsController?.abort();freednsScanController?.abort()}
  function clearFreednsCache(){
    if(freednsScraping||freednsPageScanning||freednsFullScanning){showNotice('Stop the active work before clearing the cache.','error',true);return;}
    if(!freednsCache.domains.length)return;if(!confirm('Clear the FreeDNS registry cache stored on this device?'))return;
    freednsCache={domains:[],totalPages:0,totalDomains:0,lastScrapedAt:'',complete:false};freednsVerdicts={vendors:[],verdicts:{},updatedAt:''};freednsPage=1;try{localStorage.removeItem(FREEDNS_KEY);localStorage.removeItem(FREEDNS_VERDICTS_KEY)}catch{}renderFreedns();showNotice('Local FreeDNS registry cache and saved verdicts cleared.');
  }
  function exportFreedns(){
    if(!freednsCache.domains.length){showNotice('Scrape the FreeDNS registry before exporting it.','error',true);return;}
    const content=[['id','domain','status','hostsInUse'],...freednsCache.domains.map(entry=>[entry.id,entry.domain,entry.status,entry.hosts])].map(row=>row.map(csvCell).join(',')).join('\n');
    const blob=new Blob([content],{type:'text/csv'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=`nyx-freedns-registry-${new Date().toISOString().slice(0,10)}.csv`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);showNotice('FreeDNS registry CSV created.');
  }
  async function checkFreednsDomain(domain){
    if(freednsChecking.has(domain)||freednsFullScanning||freednsPageScanning||freednsScraping)return;
    const vendor=refs.freednsVendor?.value||'';const controller=new AbortController();freednsChecking.add(domain);renderFreedns();showNotice('');
    try{
      const report=await checkTarget(`https://${domain}/`,vendor,controller.signal);recordReport(report,'freedns');
      showNotice(vendor?`${domain} checked with ${vendorLabel(vendor)}.`:`${domain} checked across ${report.results.length} vendors.`);
    }catch(error){if(error.name!=='AbortError')showNotice(`Could not check ${domain}: ${error.message}`,'error',true);}
    finally{freednsChecking.delete(domain);renderFreedns();}
  }
  function freednsNeedsCheck(domain,vendor=''){
    const report=freednsResultsFor(domain);
    return vendor?!report.results.has(vendor):!vendors.every(key=>report.results.has(key));
  }
  async function scanFreednsPage({automatic=false}={}){
    if(freednsScraping||freednsPageScanning||freednsFullScanning||!vendors.length)return;
    const vendor=refs.freednsVendor?.value||'';
    const candidates=freednsPageState().visible.filter(entry=>freednsNeedsCheck(entry.domain,vendor));
    if(!candidates.length){if(!automatic)showNotice('Every domain on this page already has results for the selected vendors.');return;}
    freednsScanController?.abort();freednsScanController=new AbortController();const {signal}=freednsScanController;
    freednsPageScanning=true;updateFreednsActions();showNotice('');setFreednsScanProgress(0,candidates.length);
    let cursor=0;let completed=0;let failed=0;let rateLimited=false;
    const worker=async()=>{
      while(!signal.aborted){
        const index=cursor;cursor+=1;if(index>=candidates.length)return;
        const domain=candidates[index].domain;freednsChecking.add(domain);renderFreedns();
        let counted=false;
        try{const report=await checkTarget(`https://${domain}/`,vendor,signal);recordReport(report,'freedns',false);counted=true;}
        catch(error){
          if(error.name==='AbortError')return;
          if(error.status===429){rateLimited=true;freednsScanController.abort();return;}
          failed+=1;counted=true;
        }finally{
          freednsChecking.delete(domain);
          if(counted){completed+=1;setFreednsScanProgress(completed,candidates.length,failed);}
          renderFreedns();
        }
      }
    };
    try{await Promise.all(Array.from({length:Math.min(FREEDNS_SCAN_CONCURRENCY,candidates.length)},worker));}
    finally{
      freednsPageScanning=false;freednsChecking.clear();renderWorkspace();
      if(rateLimited)showNotice(`The page scan paused after ${completed.toLocaleString()} domains because Nyx reached its safety limit. Completed results were saved; try again later.`,'error',true);
      else if(signal.aborted)showNotice(`Page scan stopped after ${completed.toLocaleString()} of ${candidates.length.toLocaleString()} domains. Completed results were saved.`);
      else showNotice(`Page scan complete: ${completed.toLocaleString()} domains checked${failed?`, ${failed.toLocaleString()} failed`:''}.`,failed?'error':'',failed>0);
    }
  }
  async function scanAllFreedns(){
    if(freednsScraping||freednsPageScanning||freednsFullScanning||!vendors.length)return;
    if(!freednsCache.complete){showNotice('Finish scraping the FreeDNS registry before checking every domain.','error',true);return;}
    try{await freednsBulkToken();}catch(error){showNotice(error.message,'error',true);return;}
    const total=freednsCache.domains.length;
    const candidates=freednsCache.domains.filter(entry=>!hasStoredFreednsVerdict(entry.domain));
    if(!candidates.length){showNotice(`All ${total.toLocaleString()} cached FreeDNS domains already have saved vendor results.`);setFreednsFullProgress(total,total);return;}
    freednsScanController?.abort();freednsScanController=new AbortController();const {signal}=freednsScanController;
    freednsFullScanning=true;updateFreednsActions();showNotice('');
    const already=total-candidates.length;let cursor=0;let processed=0;let failed=0;let unsaved=0;let persistedTotal=Object.keys(freednsVerdicts.verdicts).length;let blockingError=null;let storageFailed=false;
    setFreednsFullProgress(already,total);
    const visibleNow=domain=>freednsVisibleDomains.has(domain);
    const flush=()=>{
      if(!unsaved)return true;
      const saved=saveFreednsVerdicts();if(saved){unsaved=0;persistedTotal=Object.keys(freednsVerdicts.verdicts).length;}return saved;
    };
    const worker=async()=>{
      while(!signal.aborted){
        const index=cursor;cursor+=1;if(index>=candidates.length)return;
        const domain=candidates[index].domain;const visible=visibleNow(domain);freednsChecking.add(domain);if(visible)renderFreedns();
        let counted=false;
        try{
          const report=await checkTarget(`https://${domain}/`,'',signal,{bulk:true});
          storeFreednsVerdict(report,domain);unsaved+=1;counted=true;
          if(unsaved>=25&&!flush()){storageFailed=true;freednsScanController.abort();}
        }catch(error){
          if(error.name==='AbortError')return;
          if([401,403,429].includes(error.status)){blockingError=error;freednsScanController.abort();return;}
          failed+=1;counted=true;
        }finally{
          freednsChecking.delete(domain);
          if(counted){processed+=1;setFreednsFullProgress(already+processed,total,failed);}
          if(visible||visibleNow(domain))renderFreedns();
        }
      }
    };
    try{await Promise.all(Array.from({length:Math.min(FREEDNS_SCAN_CONCURRENCY,candidates.length)},worker));}
    finally{
      if(!flush())storageFailed=true;
      freednsFullScanning=false;freednsChecking.clear();renderWorkspace();
      if(storageFailed)showNotice(`The full scan stopped because this browser could not save more verdicts. ${persistedTotal.toLocaleString()} domain results remain saved.`,'error',true);
      else if(blockingError)showNotice(`The full scan paused after ${processed.toLocaleString()} new domains: ${blockingError.message} Saved results will be skipped when you resume.`,'error',true);
      else if(signal.aborted)showNotice(`Full scan stopped after ${processed.toLocaleString()} new domains. Saved results will be skipped when you resume.`);
      else showNotice(`Full scan complete: all ${total.toLocaleString()} domains were processed${failed?`; ${failed.toLocaleString()} need another attempt`:''}.`,failed?'error':'',failed>0);
    }
  }
  async function maybeAutoScanFreednsPage(){
    if($('[data-view="scraper"]')?.hidden||freednsAutoScanStarted||freednsScraping||freednsPageScanning||freednsFullScanning||!vendors.length)return;
    const visible=freednsPageState().visible;
    if(!visible.length||visible.some(entry=>!freednsNeedsCheck(entry.domain,'')))return;
    freednsAutoScanStarted=true;
    await scanFreednsPage({automatic:true});
  }
  function renderWorkspace(){renderDashboard();renderHistory();renderFreedns();}
  function switchView(name){
    $$('[data-view]').forEach(view=>{const active=view.dataset.view===name;view.hidden=!active;view.classList.toggle('active',active);});
    $$('[data-view-button]').forEach(button=>button.classList.toggle('active',button.dataset.viewButton===name));
    $('[data-sidebar]')?.classList.remove('open');const shade=$('[data-sidebar-shade]');if(shade)shade.hidden=true;
    window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    if(name==='scraper')void maybeAutoScanFreednsPage();
  }
  function openSavedReport(entry){
    currentTarget=entry.url||entry.target;refs.input.value=currentTarget;renderResults(entry);refs.domainSection.hidden=true;switchView('checker');
    const controller=new AbortController();void loadDomainInfo(currentTarget,controller.signal);
  }
  async function copyReport(){
    if(!lastReport)return;const lines=[`Link Checker report for ${lastReport.target}`];lastReport.results.forEach(result=>{const state=resultState(result);lines.push(`${result.label||vendorLabel(result.filter)}: ${state.label}${result.category?` — ${result.category}`:''}`);});
    try{await navigator.clipboard.writeText(lines.join('\n'));showNotice('Report copied to the clipboard.');}catch{showNotice('Clipboard access was unavailable.','error',true);}
  }
  function csvCell(value){const text=String(value??'');return /[",\n]/.test(text)?`"${text.replace(/"/g,'""')}"`:text}
  function exportRecords(format){
    if(!history.length){showNotice('There is no scan data to export.','error',true);return;}
    const rows=history.map(entry=>({checkedAt:entry.checkedAt,source:entry.source,url:entry.url,target:entry.target,verdict:verdictFor(entry),blockedBy:(entry.blockedBy||[]).join('|'),vendors:entry.results||[]}));
    const content=format==='csv'?[['checkedAt','source','url','target','verdict','blockedBy','vendorResults'],...rows.map(row=>[row.checkedAt,row.source,row.url,row.target,row.verdict,row.blockedBy,JSON.stringify(row.vendors)])].map(row=>row.map(csvCell).join(',')).join('\n'):JSON.stringify(rows,null,2);
    const blob=new Blob([content],{type:format==='csv'?'text/csv':'application/json'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=`nyx-link-checker-${new Date().toISOString().slice(0,10)}.${format}`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);showNotice(`${format.toUpperCase()} export created.`);
  }
  function clearHistory(){
    if(!history.length)return;if(!confirm('Clear all Link Checker history stored on this device?'))return;history=[];writeJsonStorage(HISTORY_KEY,history);renderWorkspace();showNotice('Local scan history cleared.');
  }
  function saveSettings(){writeJsonStorage(SETTINGS_KEY,settings);applyTheme();renderDashboard();}
  function wireEvents(){
    refs.form.addEventListener('submit',runCheck);$('[data-copy-results]').addEventListener('click',copyReport);
    $('[data-recheck]').addEventListener('click',()=>{if(currentTarget){refs.input.value=currentTarget;void runCheck();}});
    $$('[data-view-button]').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.viewButton)));
    $('[data-dashboard-search-form]').addEventListener('submit',event=>{event.preventDefault();dashboardPage=1;renderDashboard();});
    $('[data-dashboard-search]').addEventListener('input',()=>{dashboardPage=1;renderDashboard();});
    $('[data-dashboard-vendor]').addEventListener('change',()=>{dashboardPage=1;renderDashboard();});
    $$('[data-dashboard-verdict]').forEach(button=>button.addEventListener('click',()=>{dashboardVerdict=button.dataset.dashboardVerdict||'';$$('[data-dashboard-verdict]').forEach(item=>item.classList.toggle('active',item===button));dashboardPage=1;renderDashboard();}));
    $('[data-dashboard-prev]').addEventListener('click',()=>{dashboardPage-=1;renderDashboard();});$('[data-dashboard-next]').addEventListener('click',()=>{dashboardPage+=1;renderDashboard();});
    refs.freednsStart.addEventListener('click',()=>void startFreednsScrape());refs.freednsCheckAll.addEventListener('click',()=>void scanAllFreedns());refs.freednsCheckPage.addEventListener('click',()=>void scanFreednsPage());refs.freednsStop.addEventListener('click',stopFreednsWork);
    refs.freednsSearch.addEventListener('input',()=>{freednsPage=1;renderFreedns();});refs.freednsStatus.addEventListener('change',()=>{freednsPage=1;renderFreedns();});refs.freednsVendor.addEventListener('change',renderFreedns);
    $('[data-freedns-export]').addEventListener('click',exportFreedns);$('[data-freedns-clear]').addEventListener('click',clearFreednsCache);
    $('[data-freedns-prev]').addEventListener('click',()=>{freednsPage-=1;renderFreedns();});$('[data-freedns-next]').addEventListener('click',()=>{freednsPage+=1;renderFreedns();});
    $$('[data-export]').forEach(button=>button.addEventListener('click',()=>exportRecords(button.dataset.export)));$$('[data-clear-history]').forEach(button=>button.addEventListener('click',clearHistory));
    const pageSize=$('[data-setting-page-size]');pageSize.value=String(settings.pageSize||25);pageSize.addEventListener('change',()=>{settings.pageSize=Number(pageSize.value)||25;dashboardPage=1;saveSettings();});
    const notifications=$('[data-setting-notifications]');const renderNotifications=()=>{notifications.textContent=settings.notifications?'On':'Off';notifications.setAttribute('aria-pressed',String(settings.notifications));};renderNotifications();notifications.addEventListener('click',()=>{settings.notifications=!settings.notifications;renderNotifications();saveSettings();});
    const theme=$('[data-setting-theme]');theme.value=settings.theme||'inherit';theme.addEventListener('change',()=>{settings.theme=theme.value;saveSettings();});
    const sidebar=$('[data-sidebar]');const shade=$('[data-sidebar-shade]');$('[data-sidebar-toggle]').addEventListener('click',()=>{sidebar.classList.add('open');shade.hidden=false;});shade.addEventListener('click',()=>{sidebar.classList.remove('open');shade.hidden=true;});
  }
  settings={...defaultSettings,...settings};applyTheme();wireEvents();renderWorkspace();loadVendors();
})();
