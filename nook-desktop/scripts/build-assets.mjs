import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root = path.resolve(import.meta.dirname, '..');
const source = fs.readFileSync(path.join(root, 'node_modules/@hugeicons/core-free-icons/dist/cjs/index.js'), 'utf8');
const names = {search:'Search01Icon',new:'Edit02Icon',dashboard:'DashboardSquare01Icon',chat:'MessageMultiple01Icon',files:'File01Icon',terminal:'ComputerTerminal01Icon',jobs:'Clock01Icon',tasks:'CheckListIcon',conductor:'Rocket01Icon',operations:'UserGroupIcon',memory:'BrainIcon',skills:'PuzzleIcon',profiles:'UserMultipleIcon',settings:'Settings01Icon',collapse:'ArrowLeft01Icon',expand:'ArrowRight01Icon',send:'ArrowUp02Icon',close:'Cancel01Icon',pause:'PauseIcon',stop:'StopIcon',folder:'Folder01Icon',web:'Globe02Icon',user:'UserIcon'};
const icons = {};
for (const [name, exportName] of Object.entries(names)) {
  const match = source.match(new RegExp('const '+exportName+' = [^\\[]*(\\[[\\s\\S]*?\\n\\]);'));
  if (!match) throw Error('Missing Hugeicons export: '+exportName);
  icons[name] = vm.runInNewContext(match[1], {}, {timeout: 1000});
}
fs.writeFileSync(path.join(root, 'src/icons.js'), 'window.NookIcons = '+JSON.stringify(icons)+';\n');
const web = fs.readFileSync(path.join(root, '../chapels/agents/models.js'), 'utf8');
const fragment = web.slice(web.indexOf('  const modelCompanies={'), web.indexOf('const companyOrder='));
if (!fragment || !fragment.includes('function modelIcon')) throw Error('Nook model branding source changed.');
const branding = vm.runInNewContext(fragment+'; ({companies:modelCompanies, icon:modelIcon})', {document:{getElementById:()=>null}}, {timeout:1000});
const assets = path.join(root, 'resources/model-icons');
fs.mkdirSync(assets, {recursive:true});
const models = {};
const samples = [...Object.keys(branding.companies).map(key=>key+'/'), 'anthropic/claude','google/gemma','moonshotai/kimi','x-ai/grok','tencent/hunyuan'];
for (const id of samples) {
  const html = branding.icon({id});
  const themed = html.match(/agents\/icons\/([^'"\)]+)/)?.[1];
  const file = themed || html.match(/ai-companies\/([^'"\)]+)/)?.[1];
  if (!file) continue;
  fs.copyFileSync(path.join(root, themed ? '../chapels/agents/icons' : '../relics/icons/ai-companies', file), path.join(assets, file));
  models[id] = {file, mask:html.includes('ai-company-logo-mono')};
}
fs.copyFileSync(path.join(root, '../relics/icons/ai-companies/LICENSE'), path.join(assets, 'LICENSE'));
fs.writeFileSync(path.join(root, 'src/model-branding.js'), 'window.NookBranding = '+JSON.stringify({companies:branding.companies, models})+';\n');
console.log('Generated '+Object.keys(icons).length+' Hermes Hugeicons and '+Object.keys(models).length+' Nook model mappings.');
