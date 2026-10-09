const fs = require('node:fs');
const path = require('node:path');
const {randomUUID} = require('node:crypto');
const {Workspace, hash} = require('./files.cjs');
const excluded = name => /^(?:dist|build|release|target|\.next|\.cache|\.venv|venv|\.worktrees|\.codex-artifacts)$/i.test(name);
class ProjectBridge {
  constructor({root, directory, vm}) {
    this.original = new Workspace(root, path.join(directory, 'backups'));
    this.directory = directory;
    this.vm = vm;
    this.file = path.join(directory, 'projects', hash(this.original.root) + '.json');
    this.state = null;
    try {
      const saved = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (saved.root === this.original.root && /^[a-f0-9-]{36}$/.test(saved.id)) this.state = saved;
    } catch {}
  }
  save() {
    fs.mkdirSync(path.dirname(this.file), {recursive:true});
    const temporary = this.file + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(this.state));
    fs.renameSync(temporary, this.file);
  }
  status() { return {root:this.original.root, ready:!!this.state, files:Object.keys(this.state?.files || {}).length, skipped:this.state?.skipped || [], guest:this.state ? '/home/nook-agent/workspace/projects/' + this.state.id : ''}; }
  scan() {
    const files = [], skipped = [];
    let total = 0, visited = 0;
    const walk = (folder, depth) => {
      if (depth > 20) throw Error('Project nesting exceeds 20 directories.');
      for (const item of fs.readdirSync(this.original.resolve(folder), {withFileTypes:true})) {
        if (++visited > 10000) throw Error('Project exceeds 10,000 entries. Select a smaller project.');
        const relative = [folder,item.name].filter(Boolean).join('/');
        let location, stat;
        try { location = this.original.resolve(relative); stat = fs.lstatSync(location); } catch { skipped.push(relative); continue; }
        if (excluded(item.name)) { skipped.push(relative); continue; }
        if (stat.isDirectory()) walk(relative, depth+1);
        else if (stat.isFile()) {
          if (stat.size > 4000000) { skipped.push(relative); continue; }
          total += stat.size;
          if (total > 50000000) throw Error('Project exceeds the 50 MB transfer limit. Select a smaller project.');
          files.push({path:relative, size:stat.size, hash:hash(fs.readFileSync(location))});
        }
      }
    };
    walk('', 0);
    return {files, skipped};
  }
  async prepare(signal, progress = () => {}) {
    if (this.state) return this.status();
    const snapshot = this.scan(), id = randomUUID();
    await this.vm.run('mkdir', {path:'projects/' + id}, signal);
    const guest = this.vm.project(id);
    for (let index = 0; index < snapshot.files.length; index++) {
      const file = snapshot.files[index], data = fs.readFileSync(this.original.resolve(file.path));
      if (hash(data) !== file.hash) throw Error('Project changed during transfer. Try again.');
      for (let offset = 0; offset < Math.max(1, data.length); offset += 128000) {
        await guest.run('project.upload', {path:file.path, offset, data:data.subarray(offset,offset+128000).toString('base64')}, signal);
      }
      progress(index+1, snapshot.files.length);
    }
    const manifest = await this.manifest(guest, signal);
    if (snapshot.files.some(file => manifest.get(file.path)?.hash !== file.hash)) throw Error('Project transfer could not be verified.');
    this.state = {id, root:this.original.root, files:Object.fromEntries(snapshot.files.map(file => [file.path,file.hash])), skipped:snapshot.skipped};
    this.save();
    return this.status();
  }
  guest() { if (!this.state) throw Error('Open the project in the workspace first.'); return this.vm.project(this.state.id); }
  async manifest(guest = this.guest(), signal) {
    const result = new Map();
    for (let offset = 0; ; offset += 40) {
      const page = await guest.run('project.manifest', {offset}, signal);
      for (const file of page.files) { try { this.original.resolve(file.path, true); } catch(error) { if(error.code !== 'ENOENT') throw error; } result.set(file.path, file); }
      if (!page.more) return result;
      if (offset >= 10000) throw Error('Workspace exceeds the review limit.');
    }
  }
  localHash(relative) {
    try { const target = this.original.resolve(relative); if (fs.statSync(target).size > 4000000) throw Error('Local file exceeds review limit.'); return hash(fs.readFileSync(target)); }
    catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  }
  async changes(signal) {
    const manifest = await this.manifest(undefined, signal), result = [];
    for (const relative of new Set([...Object.keys(this.state.files), ...manifest.keys()])) {
      const before = this.state.files[relative] || null, after = manifest.get(relative)?.hash || null;
      if (before === after) continue;
      let conflict = false;
      try { conflict = this.localHash(relative) !== before; } catch { conflict = true; }
      result.push({path:relative, before, hash:after, kind:after ? before ? 'modified':'added':'deleted', conflict, size:manifest.get(relative)?.size || 0});
    }
    return result;
  }
  async download(relative, expected, signal) {
    const chunks = [];
    let offset = 0;
    while (true) {
      const part = await this.guest().run('project.download', {path:relative, offset}, signal);
      const data = Buffer.from(part.data, 'base64'); chunks.push(data); offset += data.length;
      if (offset > 4000000) throw Error('File exceeds the 4 MB review limit.');
      if (!part.more) break;
      if (!data.length) throw Error('Incomplete file transfer.');
    }
    const bytes = Buffer.concat(chunks);
    if (hash(bytes) !== expected) throw Error('Workspace changed during review. Try again.');
    return bytes;
  }
  async apply(paths, approve, signal) {
    const changes = await this.changes(signal);
    const selected = paths?.length ? changes.filter(file => paths.includes(file.path)) : changes;
    if (!selected.length) return {applied:[]};
    if (selected.some(file => file.conflict)) throw Error('Your local files changed. Resolve conflicts before applying.');
    const prepared = [];
    for (const file of selected) prepared.push({...file, bytes:file.hash ? await this.download(file.path,file.hash,signal) : null});
    const detail = prepared.map(file => file.kind + ' ' + file.path + '\n' + (file.bytes ? file.bytes.includes(0) ? '[binary file]' : file.bytes.toString('utf8').slice(0,2000) : '[delete file]')).join('\n\n');
    if (!await approve('Apply workspace changes to your project?', this.original.root + '\n\n' + detail.slice(0,45000) + '\n\nRecovery copies are saved. Newer local edits will not be overwritten.', signal)) throw Object.assign(Error('Apply declined.'), {code:'DENIED'});
    if (signal?.aborted) throw Error('Stopped.');
    for (const file of prepared) if (this.localHash(file.path) !== file.before) throw Error('Local project changed during review. Nothing was applied.');
    const fresh = await this.changes(signal);
    for (const file of prepared) if (!fresh.some(item => item.path === file.path && item.hash === file.hash)) throw Error('Workspace changed during approval. Review again.');
    const applied = [];
    for (const file of prepared) {
      if (signal?.aborted) throw Error('Stopped. Applied so far: ' + applied.join(', '));
      if (this.localHash(file.path) !== file.before) throw Error('Local file changed: ' + file.path);
      let folder = '';
      for (const part of file.path.split('/').slice(0,-1)) { folder = [folder,part].filter(Boolean).join('/'); try { this.original.resolve(folder); } catch (error) { if (error.code !== 'ENOENT') throw error; this.original.mkdir(folder); } }
      const target = this.original.resolve(file.path, true), receipt = randomUUID();
      fs.writeFileSync(path.join(this.original.backup,receipt+'.project.json'), JSON.stringify({path:file.path,root:this.original.root,before:file.before,after:file.hash,base64:file.before ? fs.readFileSync(target).toString('base64') : null}), {flag:'wx'});
      if (file.bytes) {
        const temporary = path.join(path.dirname(target), '.nook-' + receipt + '.tmp');
        fs.writeFileSync(temporary,file.bytes,{flag:'wx'});
        this.original.resolve(file.path,true);
        if (this.localHash(file.path) !== file.before) { fs.unlinkSync(temporary); throw Error('Local file changed before saving.'); }
        fs.renameSync(temporary,target);
      } else fs.unlinkSync(target);
      if (this.localHash(file.path) !== file.hash) throw Error('Applied file verification failed. Recovery copy: ' + receipt);
      if (file.hash) this.state.files[file.path] = file.hash; else delete this.state.files[file.path];
      this.save(); applied.push(file.path);
    }
    return {applied, verified:true};
  }
}
module.exports = {ProjectBridge};
