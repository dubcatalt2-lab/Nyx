import {adaptFishingAction} from './blooket-fishing-actions.mjs';
import {adaptDefense2Action} from './blooket-defense2-actions.mjs';
import {adaptCryptoAction} from './blooket-crypto-actions.mjs';
import {adaptBrawlAction} from './blooket-brawl-actions.mjs';
import {parse} from 'acorn';
export function adaptAction(source, path = '') {
 const current=adaptBrawlAction(path)||adaptDefense2Action(path)||adaptCryptoAction(path)||adaptFishingAction(path);if(current)return current;
 // Question tools use a new DOM/React-props adapter; no legacy class-state setter.
 const questionTools = {
  'global/autoAnswer.js':['answer',false], 'global/intervals/autoAnswer.js':['answer',true],
  'global/highlightAnswers.js':['highlight',false], 'global/intervals/highlightAnswers.js':['highlight',true],
  'global/subtleHighlightAnswers.js':['subtle',false], 'global/intervals/subtleHighlightAnswers.js':['subtle',true],
  'global/intervals/percentAutoAnswer.js':['percentage',true]
 };
 if(questionTools[path]) {
  const [mode,repeat]=questionTools[path];
  return {code:`(async()=>runBlooketQuestionTool(${JSON.stringify(mode)},${repeat},setInterval,onBlooketCleanup,prompt))()`,adapted:0,expected:[],requirements:[{kind:'question'}],implementation:'native-question'};
 }
 // Keep every upstream timer under the connector's Stop/disconnect lifecycle.
 source=source.replaceAll('window.setInterval(', 'setInterval(').replaceAll('window.setTimeout(', 'setTimeout(');
 if(path==='global/autoAnswer.js'||path==='global/intervals/autoAnswer.js')source=source.replaceAll('stateNode.state.question.qType', 'Question.qType');
 if(path==='global/intervals/percentAutoAnswer.js')source=source.replaceAll('stateNode.state.question.qType', 'question.qType');
 if(path==='global/sellDuplicateBlooks.js')source=source.replace('stateNode.setState({ blook, numToSell: stateNode.state.blookData[blook] - 1 });', 'await new Promise(resolve => stateNode.setState({ blook, numToSell: stateNode.state.blookData[blook] - 1 }, resolve));');
 if(path==='global/useAnyBlook.js')source=source.replace('stateNode.render();', 'try { stateNode.render(); } finally { Object[key] = old; }\n            if (!blooks) throw Error("The blook list was not found on this page.");');
 source=source.replaceAll('Object.values(document.querySelector("#phaser-bouncy"))[0].return.updateQueue.lastEffect.deps','resolveBlooketEffect()');
 source=source.replaceAll('resolveBlooketEffect()[0].current.config.sceneConfig','resolveBlooketScene()');
 if(path==='doom/maxCards.js')source=source.replace('stateNode.forceUpdate()', 'resolveBlooketState(["props.tower","forceUpdate"]).forceUpdate()');
 if(path==='global/spamBuyBlooks.js'){
   const first=source.indexOf('(async () =>'),nested=source.indexOf('(async () =>',first+1);
   if(nested<0)throw Error('Pack action structure changed');
   source=source.slice(0,nested)+'await '+source.slice(nested);
 }
 if(path==='global/intervals/percentAutoAnswer.js'){
   source=source.replace("let i = document.querySelector('iframe');", 'let i = iframe;');
   source=source.replace('getEventListeners(window).keydown?.find(x => (aap = x.listener.aap))', '(aap = window[Symbol.for("nyx.blooket.percent-answer")]?.aap) != null');
   source=source.replace('clearInterval(cancel.interval);', 'clearInterval(cancel.interval); if (window[Symbol.for("nyx.blooket.percent-answer")] === cancel) delete window[Symbol.for("nyx.blooket.percent-answer")];');
   const start=source.indexOf('            cancel.aap ='),end=source.indexOf('            window.addEventListener',start);
   if(start<0||end<0)throw Error('Percentage action structure changed');
   source=source.slice(0,start)+'            const answer = prompt("What percentage of answers should be correct? (0-100)");\n            if (answer === null) return;\n            cancel.aap = Number(answer);\n            if (!Number.isFinite(cancel.aap) || cancel.aap < 0 || cancel.aap > 100) throw Error("Enter a percentage from 0 to 100.");\n'+source.slice(end);
   source=source.replace('window.addEventListener("keydown", cancel);', 'window.addEventListener("keydown", cancel); window[Symbol.for("nyx.blooket.percent-answer")] = cancel; onBlooketCleanup(() => { window.removeEventListener("keydown", cancel); if (window[Symbol.for("nyx.blooket.percent-answer")] === cancel) delete window[Symbol.for("nyx.blooket.percent-answer")]; });');
   source=source.replace('} catch { }', '} catch (error) { throw error; }');
 }
 source=source.replaceAll('Object.values(document.querySelector("[class*=modal]"))[0]', 'resolveBlooketFiber("[class*=modal]")');
 const ast=parse(source,{ecmaVersion:'latest'}),edits=[];
 const walk=(node,fn)=>{if(!node||typeof node!=='object')return;fn(node);for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(v=>walk(v,fn));else if(value&&typeof value==='object')walk(value,fn);}};
 walk(ast,node=>{if(node.type==='MemberExpression'&&node.property.name==='_owner'&&/^Object\.values\(/.test(source.slice(node.start,node.end))&&source.slice(node.start,node.end).includes('function react('))edits.push({start:node.start,end:node.end});});
 for(const e of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,e.start)+'({stateNode:resolveBlooketState()})'+source.slice(e.end);
 const typingEdits=[];
 walk(parse(source,{ecmaVersion:'latest'}),n=>{if(n.type==='MemberExpression'&&n.property.name==='stateNode'&&source.slice(n.start,n.end).startsWith('Object.values(document.querySelector(')&&source.slice(n.start,n.end).includes('typingAnswerWrapper'))typingEdits.push({start:n.start,end:n.end});});
 for(const e of typingEdits.sort((a,b)=>b.start-a.start))source=source.slice(0,e.start)+'resolveBlooketState(["sendAnswer"])'+source.slice(e.end);
 if(source.includes('function react('))throw Error('Unadapted React lookup');
 source=source.replaceAll('({stateNode:resolveBlooketState()}).state.', '({stateNode:resolveBlooketState()}).stateNode.state.').replaceAll('({stateNode:resolveBlooketState()}).props.', '({stateNode:resolveBlooketState()}).stateNode.props.');
 const gameEdits=[];
 walk(parse(source,{ecmaVersion:'latest'}),node=>{
   if(node.type!=='MemberExpression')return;
   const text=source.slice(node.start,node.end);
   if(text.endsWith('.game.current.config.sceneConfig'))gameEdits.push({start:node.start,end:node.end,text:'resolveBlooketScene()'});
   else if(text.endsWith('.game.current')&&!source.slice(node.end).startsWith('.config.sceneConfig'))gameEdits.push({start:node.start,end:node.end,text:'resolveBlooketGame()'});
 });
 for(const edit of gameEdits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);
 const paths=new Set(), aliases=new Map([['stateNode',[]]]);
 const remember=p=>{if(p.length)paths.add(p.slice(0,p[0]==='state'||p[0]==='props'?2:1).join('.'));};
 const chain=n=>{
   if(n?.type==='Identifier'&&aliases.has(n.name))return aliases.get(n.name);
   if(n?.type==='MemberExpression'){
     if(n.property.name==='stateNode')return [];
     const parent=chain(n.object);
     if(parent&&(!n.computed||n.property.type==='Literal'))return [...parent,n.computed?String(n.property.value):n.property.name];
   }
   if(n?.type==='ObjectExpression'&&n.properties.some(p=>p.key?.name==='stateNode'&&p.value?.callee?.name==='resolveBlooketState'))return ['$owner'];
   return null;
 };
 const bind=(pattern,path)=>{
   if(pattern.type==='Identifier'){aliases.set(pattern.name,path);remember(path);}
   if(pattern.type==='ObjectPattern')for(const prop of pattern.properties){
     if(prop.type!=='Property'||prop.computed)continue;
     const next=path[0]==='$owner'&&prop.key.name==='stateNode'?[]:[...path,prop.key.name];
     bind(prop.value,next);
   }
 };
 const adaptedAst=parse(source,{ecmaVersion:'latest'});
 for(let pass=0;pass<3;pass++)walk(adaptedAst,n=>{if(n.type==='VariableDeclarator'){const path=chain(n.init);if(path)bind(n.id,path);}});
 walk(adaptedAst,n=>{
   if(n.type==='MemberExpression'){const p=chain(n);if(p?.length)remember(p);}
   if(n.type==='CallExpression'&&n.callee?.property?.name==='setState'&&chain(n.callee.object)&&n.arguments[0]?.type==='ObjectExpression')
     for(const p of n.arguments[0].properties)if(p.key?.name)paths.add('state.'+p.key.name);
 });
 const expected=path==='crypto/alwaysTriple.js' ? ['state.choices','setState'] : path==='gold/removeBadChoices.js' ? ['constructor.prototype.answerNext'] : [...paths].filter(p=>!['state','props'].includes(p));
 const questionAction = /^global\/(?:intervals\/)?(?:autoAnswer|percentAutoAnswer|highlightAnswers|subtleHighlightAnswers)\.js$/.test(path);
 const contract = questionAction ? [['state.question'],['props.client.question']] : path==='global/useAnyBlook.js' ? [['render','setState','state.unlocks'],['render','setState','state.blookData']] : path==='gold/alwaysTriple.js' ? ['state.gold','state.choices','setState','choosePrize'] : expected;
 source=source.replaceAll('resolveBlooketState()',`resolveBlooketState(${JSON.stringify(contract)})`);
 if(path==='gold/removeBadChoices.js'){
   const lookup=`({stateNode:resolveBlooketState(${JSON.stringify(expected)})}).stateNode`;
   source=source.replace('let iterator =', `const target = ${lookup};\n        let iterator =`);
   source=source.replace(lookup+'.constructor.prototype.answerNext.call', 'target.constructor.prototype.answerNext.call');
   source=source.replace('console.log(this);', '');
   source=source.replace('target.constructor.prototype.answerNext.call({ nextReady: true, here: true, state: { correct: true }, setState() {} });', 'const patched = Array.prototype[Symbol.iterator];\n        const restore = () => { if (Array.prototype[Symbol.iterator] === patched) Array.prototype[Symbol.iterator] = iterator; };\n        onBlooketCleanup(restore);\n        try { target.constructor.prototype.answerNext.call({ nextReady: true, here: true, state: { correct: true }, setState() {} }); } catch (error) { restore(); throw error; }');
 }
 // Scene-only actions no longer need an unused class component lookup.
 if(path==='tower-defense-2/removeEnemies.js')source=source.replace('let { stateNode } = ({stateNode:resolveBlooketState([])});', '');
 const scenePurpose = path==='brawl/invincibility.js' ? 'brawl-damage' : path==='brawl/magnet.js' ? 'brawl-magnet' : path==='brawl/nextLevel.js' ? 'brawl-xp' : path.startsWith('brawl/') ? 'brawl-enemies' : path==='flappy/toggleGhost.js' ? 'flappy-avatar' : path==='tower-defense-2/removeEnemies.js' ? 'td2-enemies' : null;
 if(source.includes('resolveBlooketScene()')) {
   if(!scenePurpose)throw Error('Missing scene requirements for '+path);
   source=source.replaceAll('resolveBlooketScene()',`resolveBlooketScene(${JSON.stringify(scenePurpose)})`);
 }
 // Imported scripts must not replace the browser's dialog functions.
 const dialogEdits=[];
 walk(parse(source,{ecmaVersion:'latest'}),node=>{
  if(node.type==='AssignmentExpression'&&node.left.type==='MemberExpression'&&node.left.object.name==='window'&&['prompt','alert','confirm'].includes(node.left.property.name))dialogEdits.push({start:node.start,end:node.end});
 });
 for(const edit of dialogEdits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+'void 0'+source.slice(edit.end);
 const numberEdits=[];
 walk(parse(source,{ecmaVersion:'latest'}),node=>{
  if(node.type!=='CallExpression'||!['parseInt','parseFloat','Number'].includes(node.callee.name))return;
  const input=node.arguments[0];if(input?.type!=='CallExpression'||!(input.callee.name==='prompt'||input.callee.property?.name==='prompt'))return;
  numberEdits.push({start:node.start,end:node.end,text:`readBlooketNumber(${source.slice(input.start,input.end)},${JSON.stringify(node.callee.name==='parseInt'?'integer':'number')})`});
 });
 for(const edit of numberEdits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.text+source.slice(edit.end);
 const requirements=[];
 walk(parse(source,{ecmaVersion:'latest'}),node=>{
  if(node.type!=='CallExpression'||node.callee.type!=='Identifier')return;
  const kind={resolveBlooketState:'component',resolveBlooketGame:'game',resolveBlooketScene:'scene',resolveBlooketEffect:'effect',resolveBlooketFiber:'fiber'}[node.callee.name];
  if(!kind||kind==='component'&&requirements.some(r=>r.kind==='component'))return;
  const argument=node.arguments[0];
  const value=argument ? JSON.parse(source.slice(argument.start,argument.end)) : null;
  requirements.push({kind,value});
 });
 return {code:source,adapted:edits.length,expected:contract,requirements,implementation:'legacy-adapted'};
}
