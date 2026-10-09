const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const {Workspace, hash} = require('./files.cjs');
class TestWorkspace {
  constructor(original, directory, backup) {
    this.original = new Workspace(original, backup);
    this.directory = path.join(directory, randomUUID());
    this.root = path.join(this.directory, 'project');
    fs.mkdirSync(this.root, {recursive:true});
    this.files = new Map(); this.skipped = []; let total = 0;
    this.walk(this.original, (relative, target, info) => {
      if (info.size > 4000000) { this.skipped.push(relative); return; }
      total += info.size;
      if (total > 50000000) throw Error('Project copy exceeds 50 MB. Choose a smaller project folder.');
      const bytes = fs.readFileSync(target);
      const destination = path.join(this.root, ...relative.split('/'));
      fs.mkdirSync(path.dirname(destination), {recursive:true}); fs.writeFileSync(destination, bytes, {flag:'wx'});
      if (hash(fs.readFileSync(destination)) !== hash(bytes)) throw Error('Project copy verification failed.');
      this.files.set(relative, hash(bytes));
    });
    this.copy = new Workspace(this.root, backup);
    fs.writeFileSync(path.join(this.directory,'snapshot.json'), JSON.stringify({original:this.original.root,files:[...this.files],skipped:this.skipped}));
  }
  walk(workspace, callback) {
    let visited = 0;
    const visit = (folder, depth) => {
      if (depth > 20) throw Error('Project has too many nested directories.');
      for (const item of fs.readdirSync(workspace.resolve(folder),{withFileTypes:true})) {
        if (++visited > 10000) throw Error('Project has more than 10,000 entries. Choose a smaller folder.');
        const relative = [folder,item.name].filter(Boolean).join('/');
        let target, info;
        try { target=workspace.resolve(relative); info=fs.lstatSync(target); } catch { this.skipped.push(relative); continue; }
        if (info.isDirectory()) visit(relative,depth+1);
        else if (info.isFile()) callback(relative,target,info);
      }
    };
    visit('',0);
  }
  status() { return {original:this.original.root,root:this.root,copied:this.files.size,skipped:[...new Set(this.skipped)].slice(0,100)}; }
  changes() {
    const changes=[], seen=new Set(); let bytes=0;
    this.walk(this.copy,(relative,target,info)=>{
      seen.add(relative); if(info.size>4000000)return;
      bytes+=info.size;if(bytes>100000000)throw Error('Review exceeds 100 MB. Remove generated build output from the test copy first.');
      const current=fs.readFileSync(target),digest=hash(current),previous=this.files.get(relative)||null;
      if(digest!==previous)changes.push({path:relative,kind:previous?'modified':'added',hash:digest,applicable:current.length<=256000&&!current.includes(0),preview:current.includes(0)?'Binary file':current.toString('utf8').slice(0,4000)});
    });
    for(const relative of this.files.keys())if(!seen.has(relative))changes.push({path:relative,kind:'deleted',applicable:false});
    return changes.slice(0,200);
  }
  apply(relative, expectedHash) {
    const current=this.copy.read(relative);
    if(current.hash!==expectedHash)throw Error('Test copy changed since review. Refresh changes first.');
    const parts=relative.split('/');let folder='';
    for(const part of parts.slice(0,-1)){folder=[folder,part].filter(Boolean).join('/');try{this.original.resolve(folder);}catch(error){if(error.code!=='ENOENT')throw error;this.original.mkdir(folder);}}
    const result=this.original.write(relative,current.content,this.files.get(relative)||null);
    this.files.set(relative,current.hash);return result;
  }
}
module.exports={TestWorkspace};
