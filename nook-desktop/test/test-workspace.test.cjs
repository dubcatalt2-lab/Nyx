const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {TestWorkspace}=require('../src/test-workspace.cjs');
test('test workspace preserves originals, excludes secrets/links/dependencies and applies selected text with conflict checks',()=>{
  const base=fs.mkdtempSync(path.join(os.tmpdir(),'nook-copy-')),original=path.join(base,'original');fs.mkdirSync(original);
  fs.writeFileSync(path.join(original,'hello.txt'),'before');fs.writeFileSync(path.join(original,'.env'),'SECRET');fs.mkdirSync(path.join(original,'node_modules'));fs.writeFileSync(path.join(original,'node_modules','dep.txt'),'dependency');fs.symlinkSync(base,path.join(original,'escape'),'junction');
  const copy=new TestWorkspace(original,path.join(base,'copies'),path.join(base,'backups'));
  assert.equal(copy.status().copied,1);assert(!fs.existsSync(path.join(copy.root,'.env')));assert(!fs.existsSync(path.join(copy.root,'node_modules')));assert(!fs.existsSync(path.join(copy.root,'escape')));
  fs.writeFileSync(path.join(copy.root,'hello.txt'),'after');assert.equal(fs.readFileSync(path.join(original,'hello.txt'),'utf8'),'before');
  let change=copy.changes()[0];assert.equal(change.kind,'modified');copy.apply(change.path,change.hash);assert.equal(fs.readFileSync(path.join(original,'hello.txt'),'utf8'),'after');assert.equal(copy.changes().length,0);
  fs.writeFileSync(path.join(copy.root,'hello.txt'),'new copy');change=copy.changes()[0];fs.writeFileSync(path.join(original,'hello.txt'),'newer user work');assert.throws(()=>copy.apply(change.path,change.hash),/changed/);assert.equal(fs.readFileSync(path.join(original,'hello.txt'),'utf8'),'newer user work');
  fs.mkdirSync(path.join(copy.root,'new'));fs.writeFileSync(path.join(copy.root,'new','file.txt'),'new file');change=copy.changes().find(item=>item.path==='new/file.txt');copy.apply(change.path,change.hash);assert.equal(fs.readFileSync(path.join(original,'new','file.txt'),'utf8'),'new file');
  assert.throws(()=>copy.apply('../escape','x'));
});
