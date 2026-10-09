const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {createHash, randomUUID} = require('node:crypto');
const hash = value => createHash('sha256').update(value).digest('hex');
const hidden = name => /^(?:\.git|\.env(?:\..*)?|\.ssh|\.aws|\.azure|\.npmrc|\.netrc|node_modules|credentials.*)$/i.test(name) || /\.(pem|key|pfx|p12)$/i.test(name);
class Workspace {
  constructor(root, backup) {
    this.root = fs.realpathSync(root);
    if (!fs.statSync(this.root).isDirectory() || this.root === path.parse(this.root).root || this.root.toLowerCase() === os.homedir().toLowerCase()) throw Error('Choose a project folder, not an entire drive or home directory.');
    this.backup = backup;
    fs.mkdirSync(backup, {recursive: true});
  }
  resolve(relative = '', missing = false) {
    if (typeof relative !== 'string' || relative.length > 500 || /[\x00-\x1f:\\]/.test(relative) || path.isAbsolute(relative)) throw Error('Use a relative path within the selected project.');
    const parts = relative.split('/').filter(Boolean);
    if (parts.some(part => ['.', '..'].includes(part) || /[. ]$/.test(part) || hidden(part) || /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(part))) throw Error('That path is not available to the agent.');
    let current = this.root;
    if (fs.realpathSync(current) !== this.root) throw Error('Project folder changed. Select it again.');
    for (let i = 0; i < parts.length; i++) {
      current = path.join(current, parts[i]);
      try {
        const info = fs.lstatSync(current);
        if (info.isSymbolicLink() || (!info.isDirectory() && info.nlink !== 1)) throw Error('Symbolic links, junctions and hard-linked files are not allowed.');
        const actual = fs.realpathSync(current);
        if (!actual.startsWith(this.root + path.sep)) throw Error('Path leaves the project.');
      } catch (error) {
        if (error.code === 'ENOENT' && missing && i === parts.length - 1) return current;
        throw error;
      }
    }
    return current;
  }
  read(relative) {
    const target = this.resolve(relative);
    const fd = fs.openSync(target, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
      const info = fs.fstatSync(fd);
      if (!info.isFile() || info.nlink !== 1 || info.size > 256000) throw Error('Choose a text file no larger than 256 KB.');
      this.resolve(relative);
      const bytes = fs.readFileSync(fd);
      if (bytes.length > 256000 || bytes.includes(0)) throw Error('Binary or oversized files are not supported.');
      return {path: relative, content: bytes.toString('utf8'), hash: hash(bytes)};
    } finally { fs.closeSync(fd); }
  }
  list(relative = '') {
    return {path: relative, entries: fs.readdirSync(this.resolve(relative), {withFileTypes: true}).filter(item => !hidden(item.name) && !item.isSymbolicLink()).slice(0, 500).map(item => ({name: item.name, path: [relative, item.name].filter(Boolean).join('/'), directory: item.isDirectory()})).sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name))};
  }
  search(query) {
    if (typeof query !== 'string' || !query.length || query.length > 200) throw Error('Search must contain 1–200 characters.');
    const matches = []; let scanned = 0;
    const walk = (dir, depth) => {
      if (depth > 8 || scanned >= 500 || matches.length >= 50) return;
      for (const entry of this.list(dir).entries) {
        if (scanned >= 500 || matches.length >= 50) break;
        if (entry.directory) walk(entry.path, depth + 1);
        else {
          scanned++;
          try { this.read(entry.path).content.split('\n').forEach((line, index) => { if (matches.length < 50 && line.toLowerCase().includes(query.toLowerCase())) matches.push({path: entry.path, line: index + 1, text: line.slice(0, 300)}); }); } catch {}
        }
      }
    };
    walk('', 0); return {matches, scanned, limited: scanned >= 500 || matches.length >= 50};
  }
  previous(relative) { try { return this.read(relative); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
  write(relative, content, expectedHash) {
    if (typeof content !== 'string' || Buffer.byteLength(content) > 256000 || content.includes('\0')) throw Error('Invalid text content.');
    const target = this.resolve(relative, true), previous = this.previous(relative);
    if ((previous?.hash || null) !== expectedHash) throw Error('The file changed. Read it again before editing.');
    const id = randomUUID();
    const receipt = {id, root: this.root, path: relative, before: previous?.hash || null, after: hash(content), content: previous?.content ?? null};
    fs.writeFileSync(path.join(this.backup, id + '.json'), JSON.stringify(receipt), {flag: 'wx', mode: 0o600});
    const temporary = path.join(path.dirname(target), '.nook-' + id + '.tmp');
    try {
      fs.writeFileSync(temporary, content, {flag: 'wx', mode: 0o600});
      this.resolve(relative, true);
      if ((this.previous(relative)?.hash || null) !== expectedHash) throw Error('The file changed before saving.');
      fs.renameSync(temporary, target);
    } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
    const checked = this.read(relative);
    if (checked.hash !== receipt.after) throw Error('Saved file verification failed. Inspect the file and its backup.');
    return {changed: true, id, path: relative, hash: checked.hash, verified: true};
  }
  undo(id) {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw Error('Invalid change ID.');
    const receiptPath = path.join(this.backup, id + '.json');
    const receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    if (receipt.root !== this.root || receipt.undone || (this.previous(receipt.path)?.hash || null) !== receipt.after) throw Error('Undo would overwrite newer work or another project.');
    if (receipt.content === null) fs.unlinkSync(this.resolve(receipt.path));
    else this.write(receipt.path, receipt.content, receipt.after);
    receipt.undone = true; fs.writeFileSync(receiptPath, JSON.stringify(receipt));
    return {undone: true, path: receipt.path, verified: true};
  }
  mkdir(relative) {
    const target = this.resolve(relative, true);
    if (target === this.root) throw Error('Choose a new subfolder.');
    fs.mkdirSync(target); return {created: relative, verified: fs.statSync(target).isDirectory()};
  }
}
module.exports = {Workspace, hash};
