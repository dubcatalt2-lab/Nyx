// Read React-owned links only. Never depend on DOM property order or walk account data.
function inspectBlooketComponents() {
  const candidates = new Set(), roots = new Set(), visited = new Set(), games = new Set(), hookStates = [], questions = new Set(), props = new Set();
  const addQuestion = value => {
    if (value && Array.isArray(value.answers) && value.answers.length && value.answers.every(a=>typeof a==='string') &&
      (value.qType==='typing' || Array.isArray(value.correctAnswers) && value.correctAnswers.length && value.correctAnswers.every(a=>value.answers.includes(a)))) questions.add(value);
  };
  let hooks = 0;
  const addGame = value => { if (value && typeof value === 'object' && (typeof value.scene?.getScenes === 'function' || value.config?.sceneConfig?.physics?.world)) games.add(value); };
  let elements = 0;
  const add = value => {
    addGame(value?.game?.current);
    addQuestion(value?.state?.question); addQuestion(value?.props?.question); addQuestion(value?.props?.client?.question);
    if (value && typeof value === 'object' && !(value instanceof Node) &&
        (typeof value.setState === 'function' || value.game?.current)) candidates.add(value);
  };
  for (const element of document.querySelectorAll('*')) {
    if (++elements > 20000) break;
    for (const key of Object.getOwnPropertyNames(element)) {
      if (/^__react(?:Fiber|InternalInstance|Container)\$/.test(key) || key === '_reactRootContainer') {
        let fiber = element[key]?._internalRoot?.current || element[key];
        const ancestors = new Set();
        while (fiber?.return && !ancestors.has(fiber)) { ancestors.add(fiber); fiber = fiber.return; }
        roots.add(fiber?.stateNode?.current || fiber?.current || fiber);
      } else if (/^__reactProps\$/.test(key)) {
        const props = element[key], children = props?.children;
        for (const child of Array.isArray(children) ? children : [children]) add(child?._owner?.stateNode);
      }
    }
  }
  const queue = [...roots];
  for (let at = 0; at < queue.length && visited.size < 40000; at++) {
    const node = queue[at];
    if (!node || typeof node !== 'object' || visited.has(node)) continue;
    visited.add(node); add(node.stateNode); if(node.memoizedProps && typeof node.memoizedProps==='object')props.add(node.memoizedProps);
    addQuestion(node.memoizedProps?.question); addQuestion(node.memoizedProps?.client?.question);
    const inspectValue = value => { addQuestion(value); addQuestion(value?.question); add(value); add(value?.current); addGame(value); addGame(value?.current); };
    const seenHooks = new Set();
    for (let hook = node.memoizedState; hook && !seenHooks.has(hook) && seenHooks.size < 500; hook = hook.next) {
      seenHooks.add(hook); hooks++; inspectValue(hook.memoizedState);
      if (hookStates.length < 40 && typeof hook.queue?.dispatch === 'function') {
        const value = hook.memoizedState;
        hookStates.push({type:value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value,
          keys:value && !Array.isArray(value) && typeof value === 'object' ? Object.keys(value).slice(0,80) : []});
      }
      if (Array.isArray(hook.memoizedState)) inspectValue(hook.memoizedState[0]);
    }
    const seenEffects = new Set();
    for (let effect = node.updateQueue?.lastEffect; effect && !seenEffects.has(effect) && seenEffects.size < 500; effect = effect.next) {
      seenEffects.add(effect);
      if (Array.isArray(effect.deps)) effect.deps.forEach(inspectValue);
    }
    for (const next of [node.child, node.sibling]) if (next) queue.push(next);
  }
  return { props:[...props], candidates: [...candidates], games:[...games], hookStates, questions:[...questions], hooks, elements, fibers: visited.size };
}
function findBlooketProps(expected,optional=false){
 const matches=inspectBlooketComponents().props.filter(props=>expected.every(path=>blooketHasPath(props,path)));
 if(!matches.length&&optional)return null;
 if(matches.length!==1)throw Error(matches.length?'More than one matching game panel is open.':'Open the game screen this tool applies to.');
 return matches[0];
}
function findBlooketQuestion() {
  const questions = inspectBlooketComponents().questions;
  const unique = new Map(questions.map(q=>[JSON.stringify([q.answers,q.correctAnswers]),q]));
  if (unique.size !== 1) throw Error(unique.size ? 'More than one question is present in this page.' : 'No question with answer data is available on this page.');
  return [...unique.values()][0];
}
function blooketAnswerTargets(question) {
  const normalize = value => String(value).replace(/\s+/g,' ').trim();
  const candidates = [...document.querySelectorAll('button,[role="button"],[class*="answerContainer"],[class*="answerText"]')];
  return question.answers.map(answer => {
    const matches = new Set();
    for (const candidate of candidates) {
      if (!candidate.getClientRects().length || candidate.disabled || candidate.getAttribute('aria-disabled') === 'true') continue;
      const target = candidate.closest('button,[role="button"],[class*="answerContainer"]') || candidate;
      if (normalize(candidate.textContent) === normalize(answer)) matches.add(target);
    }
    // Nested answer labels can resolve to the same actual button.
    const targets = [...matches].filter(target=>![...matches].some(other=>other!==target && other.contains(target)));
    return targets.length === 1 ? targets[0] : null;
  });
}
async function runBlooketQuestionTool(mode, repeat, schedule, cleanup, ask) {
  const originals = new Map(); let lastAnswered = null, lastTarget = null;
  let percentage = 100;
  if (mode === 'percentage') {
    const value = ask('Correct answers, from 0 to 100 percent:');
    if (value === null) return {cancelled:true};
    percentage = Number(value);
    if (!String(value).trim() || !Number.isFinite(percentage) || percentage<0 || percentage>100) throw Error('Enter a number from 0 to 100.');
  }
  cleanup(()=>{for(const [element,style] of originals) { element.style.backgroundColor=style.background; element.style.outline=style.outline; } originals.clear();});
  const tick = (initial=false) => {
    let question;
    try { question=findBlooketQuestion(); } catch(error) { if(!initial&&repeat)return;throw error; }
    if(question.qType==='typing') {
      if(mode!=='answer'&&mode!=='percentage')throw Error('Highlighting needs a multiple-choice question.');
      const target=findBlooketComponent(['sendAnswer']);
      if(question!==lastAnswered){target.sendAnswer(question.answers[0]);lastAnswered=question;}
      return;
    }
    const targets = blooketAnswerTargets(question);
    if (!targets.every(Boolean)) {if(!initial&&repeat)return;throw Error('The displayed answer controls do not match this question.');}
    for(const [element] of originals)if(element.isConnected===false)originals.delete(element);
    const key = JSON.stringify([question.question, question.answers,question.correctAnswers]);
    if (mode==='answer' || mode==='percentage') {
      if (repeat && key===lastAnswered && targets[0]===lastTarget) return;
      const correct = mode!=='percentage' || Math.random()*100<percentage;
      const index = question.answers.findIndex(answer=>question.correctAnswers.includes(answer)===correct);
      if (index<0) throw Error('This question has no matching answer choice.');
      targets[index].click(); lastAnswered=key;lastTarget=targets[0];
    } else targets.forEach((element,index)=>{
      if(!originals.has(element)) originals.set(element,{background:element.style.backgroundColor,outline:element.style.outline});
      const correct=question.correctAnswers.includes(question.answers[index]);
      if(mode==='subtle') element.style.outline=correct?'2px solid #62d6a3':originals.get(element).outline;
      else element.style.backgroundColor=correct?'rgb(0, 207, 119)':'rgb(189, 15, 38)';
    });
  };
  tick(true);
  if(repeat) schedule(()=>tick(false),500);
}
function findBlooketGame() {
  const {games} = inspectBlooketComponents();
  if (games.length !== 1) throw Error(games.length ? 'More than one game is open in this tab.' : 'The running game could not be found.');
  return games[0];
}
function blooketSceneMatches(scene, purpose) {
  const world = scene?.physics?.world;
  if (!world) return false;
  const colliders = world.colliders?._active || [], bodies = world.bodies?.entries || [];
  const text = value => value?.toString?.() || '';
  switch (purpose) {
    case 'td2-services': return typeof scene.gameManager?.setCoins==='function' && typeof scene.gameManager?.setHealth==='function' &&
      Array.isArray(scene.enemyService?.enemyQueue) && Array.isArray(scene.enemyService?.extraRounds) &&
      typeof scene.enemyService?.enemies?.getChildren==='function' && typeof scene.enemyService?.emitCurrentWave==='function' &&
      typeof scene.towerService?.allTowersIterator==='function' && typeof scene.towerService?.recalculateBuffs==='function';
    case 'brawl-services': return typeof scene.enemyService?.enemies?.getChildren==='function' &&
      typeof scene.enemyService?.enemies?.classType?.prototype?.spawn==='function' &&
      typeof scene.playerService?.getPlayer==='function' && typeof scene.gameManager?.addXp==='function' &&
      typeof scene.abilityService?.upgradeAbility==='function' && typeof scene.mapService?.obstacles?.clear==='function' &&
      typeof scene.eventBus?.emit==='function';
    case 'brawl-enemies': return colliders.some(c=>text(c.callbackContext).includes('dmgCd') &&
      typeof c.object2?.classType?.prototype?.start === 'function' && Array.isArray(c.object2?.children?.entries));
    case 'brawl-damage': return colliders.some(c=>/invulnerableTime|dmgCd/.test(text(c.callbackContext)));
    case 'brawl-magnet': return colliders.some(c=>text(c.collideCallback).includes('magnetTime'));
    case 'brawl-xp': return colliders.some(c=>text(c.collideCallback).includes('emit("xp'));
    case 'flappy-avatar': return bodies.some(body=>body.gameObject?.frame?.texture?.key?.startsWith('blook'));
    case 'td2-enemies': return Array.isArray(scene.enemyQueue);
    default: return false;
  }
}
function findBlooketScene(purpose = null) {
  const game = findBlooketGame();
  const managed = typeof game.scene?.getScenes === 'function';
  const scenes = managed ? game.scene.getScenes(false) : [game.config?.sceneConfig];
  // Phaser excludes paused scenes from getScenes(true), even though their live
  // physics world still exists. Inspect it without resuming or changing the game.
  const eligible = scenes.filter(scene=>scene?.physics?.world &&
    (!managed || scene.sys?.isActive?.() || scene.sys?.isPaused?.()) &&
    (!purpose || blooketSceneMatches(scene, purpose)));
  if (eligible.length !== 1) throw Error(eligible.length
    ? `Found ${eligible.length} running or paused physics scenes matching this tool; the game scene is ambiguous. Copy connection details.`
    : `No running or paused physics scene matched this tool (${scenes.length} scenes loaded). Copy connection details.`);
  return eligible[0];
}
function blooketHasPath(node, path) {
  try {
    for (const key of path.split('.')) {
      if (!node || !(key in Object(node))) return false;
      node = node[key];
    }
    return node !== undefined && node !== null;
  } catch { return false; }
}
function findBlooketComponent(expected = []) {
  const { candidates } = inspectBlooketComponents();
  // Each alternative is a complete contract, never a partial-match score.
  const alternatives = expected.length && Array.isArray(expected[0]) ? expected : [expected];
  const matches = candidates.filter(node => alternatives.some(paths => paths.every(path => blooketHasPath(node, path))));
  if (!matches.length) throw Error('This page does not expose the game state this tool needs.');
  if (matches.length !== 1) throw Error('More than one game component matches this tool.');
  return matches[0];
}
function blooketObjectShape(value) {
  if (!value || typeof value !== 'object') return null;
  const keys = Object.keys(value).slice(0,100), methods = new Set();
  let prototype = Object.getPrototypeOf(value);
  for (let depth=0; prototype && prototype !== Object.prototype && depth<3; depth++, prototype=Object.getPrototypeOf(prototype)) {
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(prototype)))
      if (typeof descriptor.value === 'function' && key !== 'constructor') methods.add(key);
  }
  return {keys, methods:[...methods].slice(0,80)};
}
function blooketPhysicsShape(scene) {
  const world = scene?.physics?.world;
  if (!world) return null;
  const entities = new Map();
  for (const body of world.bodies?.entries || []) {
    const shape = blooketObjectShape(body.gameObject);
    if (shape) entities.set(JSON.stringify(shape),shape);
    if (entities.size >= 12) break;
  }
  return {
    scene:blooketObjectShape(scene),
    entities:[...entities.values()],
    colliders:(world.colliders?._active || []).slice(0,40).map(collider => ({
      object1:blooketObjectShape(collider.object1), object2:blooketObjectShape(collider.object2),
      firstChild1:blooketObjectShape(collider.object1?.children?.entries?.[0]),
      firstChild2:blooketObjectShape(collider.object2?.children?.entries?.[0]),
      context:blooketObjectShape(collider.callbackContext),
      hasCallback:typeof collider.collideCallback === 'function', hasProcess:typeof collider.processCallback === 'function'
    }))
  };
}
function findBlooketFiber(selector) {
  const element = document.querySelector(selector);
  const key = element && Object.getOwnPropertyNames(element).find(key=>/^__react(?:Fiber|InternalInstance)\$/.test(key));
  if (!key || !element[key]) throw Error('The game panel for this tool was not found.');
  return element[key];
}
function findBlooketEffect() {
  const element = document.querySelector('#phaser-bouncy');
  const key = element && Object.getOwnPropertyNames(element).find(key=>/^__react(?:Fiber|InternalInstance)\$/.test(key));
  let fiber = key && element[key];
  const seen = new Set(), matches = new Set();
  while (fiber && !seen.has(fiber)) {
    seen.add(fiber);
    let effect = fiber.updateQueue?.lastEffect;
    const effects = new Set();
    while (effect && !effects.has(effect)) {
      effects.add(effect);
      if (effect.deps?.[0]?.current?.config?.sceneConfig && typeof effect.deps[1] === 'function') matches.add(effect.deps);
      effect = effect.next;
    }
    fiber = fiber.return;
  }
  if (matches.size !== 1) throw Error('The Flappy Blook game controls were not found. Open Flappy Blook before running this tool.');
  return [...matches][0];
}
function blooketConnectionDetails(lastAction = null) {
  const info = inspectBlooketComponents();
  return { version:11, host:location.hostname, runtimeSources:[...document.querySelectorAll('script[src]')].map(script=>{try{const url=new URL(script.src);return url.origin+url.pathname;}catch{return '';}}).filter(Boolean).slice(0,30), elements:info.elements, fibers:info.fibers, hooks:info.hooks, games:info.games.map(game=>({keys:Object.keys(game).slice(0,40),sceneManager:typeof game.scene?.getScenes==='function',scenes:(typeof game.scene?.getScenes==='function'?game.scene.getScenes(false):[game.config?.sceneConfig]).slice(0,30).map(scene=>({active:!!scene?.sys?.isActive?.(),paused:!!scene?.sys?.isPaused?.(),sleeping:!!scene?.sys?.isSleeping?.(),hasPhysics:!!scene?.physics?.world,physicsShape:blooketPhysicsShape(scene),bodies:scene?.physics?.world?.bodies?.entries?.length||0,colliders:scene?.physics?.world?.colliders?._active?.length||0,matches:['td2-services','brawl-services','brawl-enemies','brawl-damage','brawl-magnet','brawl-xp','flappy-avatar','td2-enemies'].filter(purpose=>blooketSceneMatches(scene,purpose))}))})),
    lastAction, hookStates:info.hookStates,
    components:info.candidates.slice(0,20).map(node=>({
      stateKeys:Object.keys(node.state || {}).slice(0,80),
      propKeys:Object.keys(node.props || {}).slice(0,50),
      gameKeys:Object.keys(node.game?.current || {}).slice(0,40),
      hasSetState:typeof node.setState === 'function'
    })) };
}
// Each action owns its timers, network requests and cleanup handlers.
function readBlooketNumber(value,kind='number') {
  if(value===null){const error=Error('Action cancelled.');error.name='BlooketCancelled';throw error;}
  const number=Number(value);
  if(!String(value).trim()||!Number.isFinite(number)||(kind==='integer'&&!Number.isSafeInteger(number)))throw Error(kind==='integer'?'Enter a whole number.':'Enter a valid number.');
  return number;
}
function createBlooketTask(sendError) {
  const intervals=new Set(), timeouts=new Set(), cleanups=new Set(), controller=new AbortController();
  let stopped=false;
  const cancel=()=>{const error=Error('Action cancelled.');error.name='BlooketCancelled';return error;};
  const ensure=()=>{if(stopped)throw cancel();};
  const cleanup=fn=>{if(typeof fn!=='function')return;if(stopped)fn();else cleanups.add(fn);};
  const stop=()=>{
    if(stopped)return;stopped=true;controller.abort();
    for(const id of intervals)window.clearInterval(id);for(const id of timeouts)window.clearTimeout(id);
    intervals.clear();timeouts.clear();
    for(const fn of cleanups){try{fn();}catch(error){sendError(error);}}cleanups.clear();
  };
  const schedule=(repeat,callback,delay,...args)=>{
    ensure();if(typeof callback!=='function')throw Error('Invalid scheduled action.');
    let id,busy=false;
    const run=async()=>{
      if(!repeat)timeouts.delete(id);if(stopped||busy)return;busy=true;
      try{await callback(...args);}catch(error){if(!stopped){stop();sendError(error);}}finally{busy=false;}
    };
    id=repeat?window.setInterval(run,Math.max(50,Number(delay)||0)):window.setTimeout(run,delay);
    (repeat?intervals:timeouts).add(id);return id;
  };
  const nativePrompt=window.prompt.bind(window),nativeAlert=window.alert.bind(window),nativeConfirm=window.confirm.bind(window);
  const checkedFetch=async(input,init={})=>{
    ensure();const response=await window.fetch(input,{...init,signal:controller.signal});ensure();
    if(!response.ok)throw Error('Blooket rejected the request (HTTP '+response.status+').');return response;
  };
  return {stop,ensure,cleanup,fetch:checkedFetch,
    interval:(fn,delay,...args)=>schedule(true,fn,delay,...args), timeout:(fn,delay,...args)=>schedule(false,fn,delay,...args),
    clearInterval:id=>{intervals.delete(id);window.clearInterval(id);},clearTimeout:id=>{timeouts.delete(id);window.clearTimeout(id);},
    prompt:(...args)=>{ensure();const value=nativePrompt(...args);if(value===null)throw cancel();return value;},
    alert:(...args)=>{ensure();nativeAlert(...args);},confirm:(...args)=>{ensure();if(!nativeConfirm(...args))throw cancel();return true;},
    get active(){return !stopped;},get scheduled(){return intervals.size+timeouts.size;}
  };
}
function checkBlooketRequirements(requirements) {
  for(const requirement of requirements||[]) {
    switch(requirement.kind) {
      case 'selector':if(!document.querySelector(requirement.value))throw Error('Open the game screen this tool applies to.');break;
      case 'props':findBlooketProps(requirement.value||[]);break;
      case 'component':findBlooketComponent(requirement.value||[]);break;
      case 'game':findBlooketGame();break;
      case 'scene':findBlooketScene(requirement.value);break;
      case 'effect':findBlooketEffect();break;
      case 'fiber':findBlooketFiber(requirement.value);break;
      case 'question':{const q=findBlooketQuestion();if(q.qType==='typing')findBlooketComponent(['sendAnswer']);else if(!blooketAnswerTargets(q).every(Boolean))throw Error('No matching answer controls are visible.');break;}
      default:throw Error('Unknown tool requirement.');
    }
  }
}
function connectOfficialPage(nyxOrigin, actions, contracts={}) {
  const officialHost=location.hostname==='blooket.com'||location.hostname.endsWith('.blooket.com');
  if(location.protocol!=='https:'||!officialHost||window!==window.top){alert('Open the official Blooket website in a normal br00ser tab, then click Connect to Nyx.');return;}
  const key=Symbol.for('nyx.blooket.connector.v1');
  const channel=Array.from(crypto.getRandomValues(new Uint8Array(24)),v=>v.toString(16).padStart(2,'0')).join('');
  const app=window.open(nyxOrigin+'/apps/blooket/#bridge='+channel+'&origin='+encodeURIComponent(location.origin),'_blank');
  if(!app){alert('Allow pop-ups for Blooket, then click Connect to Nyx again.');return;}
  window[key]?.close?.();
  const tasks=new Map(),seen=new Set();let closed=false,paired=false,running=null,heartbeat=0,lastAction=null;
  const send=(type,extra={})=>{if(!closed)app.postMessage({protocol:'nyx-blooket-v1',channel,type,...extra},nyxOrigin);};
  const status=()=>send('status',{connectorVersion:11,host:location.hostname,path:location.pathname,revision:'c322469ebbd192b6731480af76b1ac0a3d4a7b22'});
  const stopAll=()=>{for(const task of tasks.values())task.stop();tasks.clear();};
  const close=()=>{
    if(closed)return;send('disconnected');closed=true;stopAll();window.clearInterval(heartbeat);
    window.removeEventListener('message',receive);window.removeEventListener('pagehide',close);
    if(window[key]?.close===close)delete window[key];
  };
  const inspect=()=>Object.fromEntries(Object.keys(actions).map(path=>{
    try{checkBlooketRequirements(contracts[path]);return [path,{available:contracts[path]?.length?true:null}];}
    catch(error){return [path,{available:false,reason:String(error.message||error).slice(0,300)}];}
  }));
  async function receive(event){
    const message=event.data;
    if(closed||event.source!==app||event.origin!==nyxOrigin||message?.protocol!=='nyx-blooket-v1'||message.channel!==channel)return;
    if(message.type==='hello'){paired=true;status();return;}
    if(!paired)return;
    if(message.type==='disconnect'){close();return;}
    if(message.type==='ping'){status();return;}
    if(!['run','stop','details','inspect'].includes(message.type)||!/^[a-zA-Z0-9-]{1,80}$/.test(message.id||'')||seen.has(message.id))return;
    if(seen.size>=512){send('result',{id:message.id,error:'Reconnect the bookmark to start a new session.'});return;}seen.add(message.id);
    if(message.type==='details'){send('result',{id:message.id,details:{...blooketConnectionDetails(lastAction),selectedAction:Object.prototype.hasOwnProperty.call(actions,message.path)?message.path:null}});return;}
    if(message.type==='inspect'){send('result',{id:message.id,availability:inspect()});return;}
    if(message.type==='stop'){stopAll();send('result',{id:message.id,stopped:true});return;}
    if(running){send('result',{id:message.id,error:'Finish the current Blooket action first.'});return;}
    if(!Object.prototype.hasOwnProperty.call(actions,message.path)){send('result',{id:message.id,error:'This tool is not included in this bookmark. Save the current bookmark from Nyx.'});return;}
    lastAction=message.path;
    const task=createBlooketTask(error=>send('action-error',{path:message.path,error:String(error?.message||error).slice(0,300)}));
    running=task;
    try{
      checkBlooketRequirements(contracts[message.path]);
      tasks.get(message.path)?.stop();tasks.set(message.path,task);
      const result=await actions[message.path](task.interval,task.timeout,findBlooketComponent,findBlooketEffect,findBlooketGame,findBlooketScene,findBlooketFiber,task.cleanup,runBlooketQuestionTool,task.fetch,task.prompt,task.alert,task.confirm,task.clearInterval,task.clearTimeout,readBlooketNumber,findBlooketProps);
      task.ensure();send('result',{id:message.id,scheduled:task.scheduled,cancelled:!!result?.cancelled,message:typeof result?.message==='string'?result.message.slice(0,240):undefined});
    }catch(error){
      task.stop();if(tasks.get(message.path)===task)tasks.delete(message.path);
      if(error?.name==='BlooketCancelled'||error?.name==='AbortError')send('result',{id:message.id,cancelled:true});
      else send('result',{id:message.id,error:String(error?.message||error).slice(0,300),details:blooketConnectionDetails(lastAction)});
    }finally{if(running===task)running=null;}
  }
  window[key]={close};window.addEventListener('message',receive);window.addEventListener('pagehide',close);
  heartbeat=window.setInterval(()=>{if(app.closed)close();else if(paired)status();},2000);status();
}
const setupKey=Symbol.for('nyx.blooket.setup.v1'),setup=window[setupKey];delete window[setupKey];
if(setup)connectOfficialPage(setup.origin,setup.actions,setup.contracts);
