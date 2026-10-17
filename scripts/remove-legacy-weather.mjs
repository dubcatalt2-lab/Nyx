// One-time, structural removal of the retired desktop weather feature.
import fs from 'node:fs';
import {parse as parseHtml} from 'parse5';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
const read=p=>fs.readFileSync(p,'utf8');
const write=(p,s)=>fs.writeFileSync(p,s);
let js=read('script.js');
function cut(start,end){const a=js.indexOf(start),b=js.indexOf(end,a);if(a<0||b<0)throw Error(start);js=js.slice(0,a)+js.slice(b);}
cut('  function setWeatherContrast(', '  function applyBackgroundValue(');
cut('  function weatherDescription(', '  let nyxAiModels=');
js=js.replace(/\s*if\(hasFullscreen\) closeWeatherPanelAnimated\(\);/g,'');
js=js.replace(/(?:updateWeatherContrast\(value\)|syncHomeWeatherWidgets\(\)|closeWeatherForWindowOpen\(\)|initWeatherPanel\(\));/g,'');
js=js.replace(/<button class=\\"browser-mode-weather\\"[\s\S]*?<\/button>/g,'');
js=js.replace(/^.*(?:keepOne\('form.qc4af721dd1914ea3fa \.browser-mode-weather'\)|shellAddress\?\.querySelector\('\[data-open="weather"\]'\)).*\r?\n/gm,'');
js=js.replace("'games','weather','anime'","'games','anime'");
js=js.replace(', body.q6172f40672fb949e9c .browser-mode-weather','');
js=js.replace(/<p>[^<]*weather[^<]*<\/p>/gi,'');
js=js.replace("if(v==='weather')openWeather(open.matches('.browser-mode-weather')?'top':'bottom',open); ",'');
js=js.replace(/    document\.addEventListener\('click',e=>\{\s*if\(e\.target\.closest\('\[data-weather-refresh\]'\)\)[\s\S]*?    \},true\);/,'');
if(/weather/i.test(js))throw Error('Unremoved weather reference in main client');
write('script.js',js);
function cssClean(css){const root=postcss.parse(css);root.walkDecls(d=>{if(d.prop.startsWith('--weather-'))d.remove();});root.walkRules(rule=>{
 if(!/weather/i.test(rule.selector))return;
 const ast=selectorParser().astSync(rule.selector);
 function prune(container){for(const sel of [...container.nodes]){
  if(sel.type!=='selector')continue;
  for(const node of [...sel.nodes])if(node.type==='pseudo'&&node.nodes){prune(node);if(!node.nodes.length)node.remove();}
  if(sel.nodes.some(n=>/weather/i.test(n.toString()))||!sel.nodes.length)sel.remove();
 }}
 prune(ast);if(!ast.nodes.length)rule.remove();else rule.selector=ast.toString();
 });root.walkAtRules(rule=>{if(rule.name==='import'&&/weather/.test(rule.params))rule.remove();if(/keyframes$/.test(rule.name)&&/weather/i.test(rule.params))rule.remove();});
 root.walkComments(c=>{if(/weather/i.test(c.text))c.remove();});
 let changed=true;while(changed){changed=false;root.walkAtRules(r=>{if(r.nodes&&!r.nodes.length){r.remove();changed=true;}});}
 return root.toString();}
for(const file of ['styles.css',...fs.readdirSync('css').filter(f=>f.endsWith('.css')).map(f=>'css/'+f)]){if(file==='css/weather-redesign.css')continue;const old=read(file);if(/weather/i.test(old))write(file,cssClean(old));}
for(const file of ['index.html','index.backup-before-prompt-title.html','index.accidental-old-2026-07-10_17-59-36.html']){
 let source=read(file),edits=[];const doc=parseHtml(source,{sourceCodeLocationInfo:true});
 function visit(n){const loc=n.sourceCodeLocation;const id=n.attrs?.find(a=>a.name==='id')?.value;
  if(loc&&['weatherPanel','weatherRestore'].includes(id)){edits.push([loc.startOffset,loc.endOffset,'']);return;}
  if(n.tagName==='style'&&loc?.startTag&&loc?.endTag){const a=loc.startTag.endOffset,b=loc.endTag.startOffset;edits.push([a,b,cssClean(source.slice(a,b))]);}
  for(const c of n.childNodes||[])visit(c);
 }visit(doc);for(const [a,b,value]of edits.sort((a,b)=>b[0]-a[0]))source=source.slice(0,a)+value+source.slice(b);write(file,source);
}
for(const file of ['css/weather-redesign.css','assets/icons/cloud-weather.png'])fs.unlinkSync(file);
console.log('Removed desktop weather markup, runtime, styling and icon.');
