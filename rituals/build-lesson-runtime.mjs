import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {build} from 'esbuild';
import {parse} from 'acorn';
import {parse as html} from 'parse5';
import {prepareOfflineDocument} from './prepare-offline-document.mjs';

export const compilerBootstrap=`<script>(()=>{const attribute='src';const origin=location.origin==='null'?parent.location.origin:location.origin;const address=new URL('/assets/vendor/lesson-compiler.js',origin).href;document.write('<script '+attribute+'='+JSON.stringify(address)+'><\\/script>')})()</script>`;

export function repairLessonCode(source, asset) {
  const comments=[];
  parse(source,{ecmaVersion:'latest',sourceType:'script',onComment:comments});
  for(const comment of comments.reverse())if(/^[#@]\s*sourceMappingURL\s*=/.test(comment.value.trim()))source=source.slice(0,comment.start)+source.slice(comment.end);
  const tree=parse(source,{ecmaVersion:'latest',sourceType:'script'});
  const edits=[];
  const registries=new Map();
  let usesCompiler=false;
  const text=node=>source.slice(node.start,node.end);
  const add=(node,value)=>edits.push({start:node.start,end:node.end,value});
  const compile=(node,parameters,body)=>{usesCompiler=true;add(node,`LessonCompiler.compile(${parameters},${body})`)};
  function visit(node,ancestors=[]) {
    if(!node||typeof node!=='object')return;
    if(node.type==='CallExpression'&&node.callee.type==='MemberExpression'&&node.callee.object.name==='eval'&&node.callee.property.name==='call'&&/clcatmariogood\.html$|\/eruda.min.js$/.test(asset)){
      usesCompiler=true;add(node,`LessonCompiler.evaluateGlobal(${text(node.arguments[1])})`);return;
    }
    if(['NewExpression','CallExpression'].includes(node.type)&&node.callee.name==='Function') {
      const args=node.arguments;
      const values=args.map(arg=>arg.value);
      if(values.length===1&&values[0]==='return this')add(node,'(()=>globalThis)');
      else if(values.length===1&&values[0]==='undefined ?? 3')add(node,'(()=>undefined ?? 3)');
      else if(asset.endsWith('/eruda.min.js')) {
        const parent=ancestors.at(-1);
        if(values[0]==='toArr'&&parent?.type==='CallExpression') {
          const body=text(args[1]);
          const match=body.match(/\+([\w$]+)\+/);
          if(!match)throw Error('Unknown named constructor');
          add(parent,`Object.defineProperty(function(){var args=(${text(parent.arguments[0])})(arguments);return this.initialize?this.initialize.apply(this,args)||this:this},'name',{value:${match[1]},configurable:true})`);
        } else if(args.length===2&&values[1]==='') {add(node,"function anonymous(value){}");}
        else throw Error('Unreviewed developer-console constructor');
      } else if(asset.endsWith('clpaperio3d.html')&&values[0]==='str') {
        const owner=[...ancestors].reverse().find(n=>n.type==='FunctionDeclaration');
        if(!owner||owner.params.length!==1)throw Error('Unknown keyword predicate');
        const argument=owner.params[0].name;
        add(owner,`function ${owner.id.name}(${argument}){return Set.prototype.has.bind(new Set(${argument}.split(' ')))}`);
      } else if(values[0]==='pt') {
        const parts=[];const collect=n=>{if(n.type==='BinaryExpression'&&n.operator==='+'){collect(n.left);collect(n.right)}else parts.push(n)};collect(args[1]);
        const member=parts.find(n=>n.type==='MemberExpression');
        if(!member)throw Error('Unknown point accessor');
        usesCompiler=true;
        add(node,`(pt=>LessonCompiler.${String(parts[0].value).startsWith('return')?'coordinates':'point'}(pt,${text(member.object)}))`);
      } else if(asset.endsWith('clpaperio3d.html')) {
        compile(node,`(${text(args[0])}).split(',').map(name=>name.trim()).filter(Boolean)`,text(args[1]));
      } else {
        compile(node,'['+args.slice(0,-1).map(text).join(',')+']',text(args.at(-1)));
      }
      return;
    }
    if(node.type==='CallExpression'&&node.callee.name==='eval'&&typeof node.arguments[0]?.value!=='string') {
      if(/cl(?:catmariogood|operius|waverun)\.html$/.test(asset)) {
        let owner=tree;
        const functions=ancestors.filter(n=>/^(FunctionExpression|FunctionDeclaration|ArrowFunctionExpression)$/.test(n.type));
        if(functions.length>1)owner=functions.at(-2).body;
        const declarations=(owner.body||[]).filter(n=>n.type==='FunctionDeclaration').map(n=>n.id.name);
        if(!declarations.length)throw Error('No callback registry declarations: '+asset);
        if(!registries.has(owner)){
          let name='__lessonCallbacks'+registries.size;while(source.includes(name))name+='_';
          registries.set(owner,{name,declarations});
        }
        const {name}=registries.get(owner);
        add(node,`(key=>${name}[key]||globalThis[key])(${text(node.arguments[0])})`);
      } else if(asset.endsWith('clmonkeymartenc.html')) {
        usesCompiler=true;add(node,`LessonCompiler.run(${text(node.arguments[0])},{Module:Module})`);
      } else if(asset.endsWith('clbasketbros.html')) {
        usesCompiler=true;add(node,`LessonCompiler.run(${text(node.arguments[0])},{})`);
      } else if(asset.endsWith('/balatro/love.js')) {
        usesCompiler=true;add(node,`LessonCompiler.run(${text(node.arguments[0])},{Module:Module,UTF8ToString:UTF8ToString})`);
      } else if(asset.endsWith('/balatro/consolewrapper.js')) {
        usesCompiler=true;add(node,`LessonCompiler.run(${text(node.arguments[0])},{})`);
      }
      return;
    }
    for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(n=>visit(n,[...ancestors,node]));else if(value&&typeof value==='object')visit(value,[...ancestors,node]);}
  }
  visit(tree);
  for(const [owner,{name,declarations}]of registries){
    const statements=owner.body||[];let start=owner.type==='Program'?0:owner.start+1;
    for(const statement of statements){if(!statement.directive)break;start=statement.end;}
    edits.push({start,end:start,value:`;const ${name}=Object.assign(Object.create(null),{${declarations.map(value=>`${JSON.stringify(value)}:${value}`).join(',')}});`});
  }
  const selected=edits.filter(edit=>!edits.some(other=>other!==edit&&other.start<=edit.start&&other.end>=edit.end));
  for(const edit of selected.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.value+source.slice(edit.end);
  parse(source,{ecmaVersion:'latest',sourceType:'script'});
  return {text:source,usesCompiler,count:selected.length};
}

export async function buildLessonRuntime(root,output) {
  const offline=join(output,'assets/ugs/minecraft/EaglercraftL_1.9_v0_7_0_Offline_Signed.html');
  const prepared=prepareOfflineDocument(await readFile(offline,'utf8'));
  await writeFile(offline,prepared.source.replace('<title>EaglercraftL 1.9</title>','<title>EaglercraftL 1.9 — modified build</title>'));
  await build({entryPoints:[join(root,'rituals/lesson-compiler-entry.mjs')],bundle:true,format:'iife',platform:'browser',target:'es2022',minify:true,legalComments:'inline',outfile:join(output,'assets/vendor/lesson-compiler.js')});
  const files=['assets/ugs/A/cladventneon.html','assets/ugs/B/clbasketbros.html','assets/ugs/C/clcatmariogood.html','assets/ugs/G/clgeometrydashscratch.html','assets/ugs/M/clmonkeymartenc.html','assets/ugs/O/cloperius.html','assets/ugs/P/clpaperio3d.html','assets/ugs/W/clwaverun.html','assets/vendor/eruda.min.js','assets/vendor/hls.min.js','assets/vendor/balatro/love.js','assets/vendor/balatro/consolewrapper.js'];
  let count=0;
  for(const asset of files){
    const file=join(output,asset);let source=await readFile(file,'utf8'),usesCompiler=false;
    if(asset.endsWith('.html')){
      const edits=[];
      const walk=node=>{
        if(node.tagName==='script'&&!node.attrs.some(a=>a.name==='src')){
          const type=node.attrs.find(a=>a.name==='type')?.value||'';
          const loc=node.sourceCodeLocation;
          if(/^(?:(?:text|application)\/(?:java|ecma)script)?$/i.test(type)&&loc?.endTag){const start=loc.startTag.endOffset,end=loc.endTag.startOffset,result=repairLessonCode(source.slice(start,end),asset);edits.push({start,end,value:result.text});usesCompiler ||= result.usesCompiler;count+=result.count;}
        }
        node.childNodes?.forEach(walk);
      };walk(html(source,{sourceCodeLocationInfo:true}));
      for(const edit of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.value+source.slice(edit.end);
      if(usesCompiler)source=source.replace(/<head\b[^>]*>/i,match=>match+compilerBootstrap);
    }else{const result=repairLessonCode(source,asset);source=result.text;count+=result.count;}
    await writeFile(file,source);
  }
  const entry=join(output,'assets/vendor/balatro/index.html');
  await writeFile(entry,(await readFile(entry,'utf8')).replace(/<head\b[^>]*>/i,match=>match+compilerBootstrap));
  console.log('Lesson runtime: '+count+' reviewed runtime edits applied.');
}
