import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {inspectCode} from './audit-code.mjs';
import {auditRelease} from './audit-release.mjs';
import {repairLessonCode} from './build-lesson-runtime.mjs';
import * as compiler from '../scripture/lesson-compiler.mjs';
import vm from 'node:vm';
import {gzipSync,gunzipSync} from 'node:zlib';
import {prepareOfflineDocument} from './prepare-offline-document.mjs';

test('offline document compression is portable and preserves the edited program',()=>{
 const code='window.enableSignatureBadge=true;\n//# sourceMappingURL=private.map';
 const payload=gzipSync(code).toString('base64');
 const document='<style id="eaglercraftXClientBundle">data:application/octet-stream;base64,'+payload+'</style><style id="eaglercraftXClientSignature">old-signature</style>';
 const prepared=prepareOfflineDocument(document);
 const packed=Buffer.from(prepared.source.match(/base64,([^<]+)/)[1],'base64');
 assert.equal(packed[9],255);
 assert.equal(gunzipSync(packed).toString(),prepared.code);
 assert.equal(prepared.code,'window.enableSignatureBadge=false;\n');
 assert(!prepared.source.includes('old-signature'));
});

test('AST audit resolves aliases, computed names, constructors, shadowing and WebAssembly methods',()=>{
 const source=`const f=globalThis['Fun'+'ction'];f('return 1');const g=f.bind(null);g('return 2');const {eval:e}=window;e('1');(0,eval)('2');(function(){}).constructor('return 3');Reflect.construct(Function,['return 4']);new WebAssembly.Function({},()=>{});function local(Function,eval,atob){Function();eval();atob()}const localObject={Function(){}};localObject.Function();`;
 const result=inspectCode(source,{mode:'script'});
 assert.equal(result.calls.filter(c=>c.name==='Function').length,4);
 assert.equal(result.calls.filter(c=>c.name==='eval').length,2);
 assert.equal(result.calls.filter(c=>c.name==='atob').length,0);
 assert.equal(result.methods.filter(c=>c.name==='WebAssembly.Function').length,1);
 assert(inspectCode(`globalThis['scram'+'jet']()`).strings.some(s=>s.value==='scramjet'));
 assert.equal(inspectCode('function Widget(){};new(Function.bind.apply(Widget,[null,1]));').calls.length,0);
 assert.equal(inspectCode('new(Function.bind.apply(Function,[null,"return 1"]));').calls.length,1);
 assert.equal(inspectCode('const text="//# sourceMappingURL=fake";\n//# sourceMappingURL=data:application/json;base64,e30=').sourceMaps.length,1);
});

test('raw evidence is specific to bytes and individual matches; changed assets fail closed',async()=>{
 const root=await mkdtemp(join(tmpdir(),'release-audit-'));
 try{
  const bytes=Buffer.from([137,80,78,71,0,...Buffer.from('feRN'),0]);
  await writeFile(join(root,'image.png'),bytes);
  let result=await auditRelease(root,{evidencePath:join(root,'absent.json')});assert.equal(result.passed,false);
  const evidence=join(root,'..',root.split(/[\\/]/).at(-1)+'.json');
  await writeFile(evidence,JSON.stringify({reviews:[{sha256:createHash('sha256').update(bytes).digest('hex'),evidence:'Fixture: incidental bytes in a synthetic image; not executable JavaScript.',matches:result.matches.map(({section,contextHash})=>({section,contextHash}))}]}));
  try{
   result=await auditRelease(root,{evidencePath:evidence});assert.equal(result.passed,true);assert.equal(result.matches.length,1);
   await writeFile(join(root,'image.png'),Buffer.concat([bytes,Buffer.from([1])]));assert.equal((await auditRelease(root,{evidencePath:evidence})).passed,false);
   await writeFile(join(root,'engine.js'),`globalThis['scram'+'jet']={};`);assert((await auditRelease(root,{evidencePath:evidence})).findings.some(m=>m.value==='scramjet'));
   const packed=gzipSync('atob("YQ==");\n//# sourceMappingURL=private.map').toString('base64');
   await writeFile(join(root,'packed.html'),'<style type="application/octet-stream">data:application/octet-stream;base64,'+packed+'</style>');
   const expanded=await auditRelease(root,{evidencePath:evidence});assert.equal(expanded.counts.atob,1);assert.equal(expanded.embeddedPrograms.length,1);assert(expanded.sourceMaps.some(m=>m.file==='packed.html'));
  }finally{await rm(evidence,{force:true})}
 }finally{await rm(root,{recursive:true,force:true})}
});

test('shared compiler accepts explicit bindings, returns completion values and reports errors',()=>{
 assert.equal(compiler.compile(['state'],'return state.value + 1')({value:4}),5);
 assert.equal(compiler.run('var total = value * 2; total + 1',{value:3}),7);
 assert.throws(()=>compiler.compile(['x){}'],'return 1'),TypeError);
 assert.throws(()=>compiler.run('throw new Error("fixture")'),/fixture/);
 assert.deepEqual(compiler.coordinates({position:{x:2},y:4},['.position.x','["y"]']),[2,4]);
 assert.deepEqual(compiler.point([2,4],['.x','["y"]']),{x:2,y:4});
 assert.throws(()=>compiler.coordinates({},[';globalThis.leak=1']),TypeError);
});

test('callback registries preserve lexical callbacks and game keyword predicates become ordinary functions',()=>{
 const maps=repairLessonCode('const text="//# sourceMappingURL=literal";\n//# sourceMappingURL=private.map','fixture.js').text;
 assert(maps.includes('sourceMappingURL=literal'));assert(!maps.includes('private.map'));
 const original=`function boot(){function ready(){return 42}function lookup(name){return eval(name)}return lookup('ready')()}globalThis.answer=boot();`;
 const transformed=repairLessonCode(original,'assets/ugs/O/cloperius.html');
 const context={};vm.runInNewContext(transformed.text,context);assert.equal(context.answer,42);assert(!/\beval\(/.test(transformed.text));
 const keywords=`function predicate(words){words=words.split(' ');var body='return str === "hi"';return new Function('str',body)}globalThis.has=predicate('hi bye');`;
 const keywordContext={};vm.runInNewContext(repairLessonCode(keywords,'assets/ugs/P/clpaperio3d.html').text,keywordContext);assert.equal(keywordContext.has('hi'),true);assert.equal(keywordContext.has('no'),false);
});

test('theme selection and asset catalog identities survive path renames',async()=>{
 const source=await readFile('gospel.js','utf8');assert(source.includes("['fresh','Botany'"));assert(source.includes("'infernal-ring':'scholar-ring'"));
 const entries=JSON.parse(await readFile('relics/ugs/games.json','utf8')).filter(item=>/lesson-\d{3}\.html$/.test(item.path));assert.equal(entries.length,10);
 for(const entry of entries){assert(entry.title);assert(entry.thumbnail);assert((await readFile('relics/ugs/'+entry.path)).length>0)}
});
