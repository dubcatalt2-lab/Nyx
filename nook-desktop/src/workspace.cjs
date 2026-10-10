const {randomUUID} = require('node:crypto');
const kinds = ['skill', 'profile', 'task', 'queue'];
class Workspace {
  constructor(db, redact) {
    this.db = db;
    this.redact = redact;
    db.exec('CREATE TABLE IF NOT EXISTS workspace_items(id TEXT PRIMARY KEY,kind TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,model TEXT NOT NULL,enabled INTEGER NOT NULL,updated INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS memory_context(id TEXT PRIMARY KEY,enabled INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,title TEXT NOT NULL,updated INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS session_tasks(task TEXT PRIMARY KEY,session TEXT NOT NULL);');
  }
  items() { return this.db.prepare('SELECT * FROM workspace_items ORDER BY updated DESC LIMIT 500').all(); }
  save({id, kind, title, body = '', model = '', enabled = false}) {
    if (!kinds.includes(kind) || typeof title !== 'string' || !title.trim() || title.length > 120 || typeof body !== 'string' || body.length > 8000 || typeof model !== 'string' || model.length > 200 || typeof enabled !== 'boolean') throw Error('Enter a title and up to 8,000 characters of instructions.');
    const existing = id && this.db.prepare('SELECT * FROM workspace_items WHERE id=?').get(String(id));
    if (id && (!existing || existing.kind !== kind)) throw Error('Item no longer exists.');
    if (!id && this.items().length >= 500) throw Error('Remove an unused item before adding another.');
    id = id || randomUUID();
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (kind === 'profile' && enabled) this.db.prepare("UPDATE workspace_items SET enabled=0 WHERE kind='profile'").run();
      this.db.prepare('INSERT OR REPLACE INTO workspace_items VALUES(?,?,?,?,?,?,?)').run(id, kind, this.redact(title.trim()), this.redact(body), model, Number(enabled), Date.now());
      this.db.exec('COMMIT');
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
    return id;
  }
  remove(id) { this.db.prepare('DELETE FROM workspace_items WHERE id=?').run(String(id)); }
  memory(id, enabled) {
    if (typeof enabled !== 'boolean' || !this.db.prepare('SELECT id FROM memories WHERE id=?').get(String(id))) throw Error('Memory no longer exists.');
    this.db.prepare('INSERT OR REPLACE INTO memory_context VALUES(?,?)').run(String(id), Number(enabled));
  }
  memories() { return this.db.prepare('SELECT m.*,COALESCE(c.enabled,0) AS enabled FROM memories m LEFT JOIN memory_context c ON c.id=m.id ORDER BY m.updated DESC LIMIT 500').all(); }
  context() {
    const profile = this.items().find(item => item.kind === 'profile' && item.enabled);
    const entries = this.items().filter(item => item.kind === 'skill' && item.enabled);
    const memories = this.memories().filter(item => item.enabled);
    const text = JSON.stringify({profile: profile ? {name: profile.title, instructions: profile.body} : null, skills: entries.map(item => ({name: item.title, instructions: item.body})), memories: memories.map(item => item.text)});
    if (Buffer.byteLength(text) > 32000) throw Error('Selected memory and skills exceed 32 KB. Turn off some context before sending.');
    return {text, model: profile?.model || ''};
  }
  sessions() { return this.db.prepare('SELECT * FROM sessions ORDER BY updated DESC LIMIT 200').all(); }
  session(id, title) {
    if (id && !this.db.prepare('SELECT id FROM sessions WHERE id=?').get(String(id))) throw Error('Conversation no longer exists. Start a new session.');
    id = id || randomUUID();
    this.db.prepare('INSERT INTO sessions VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated').run(id, this.redact(title).slice(0, 120), Date.now());
    return id;
  }
  link(task, session) { this.db.prepare('INSERT INTO session_tasks VALUES(?,?)').run(task, session); }
  messages(id) {
    return this.db.prepare("SELECT e.body FROM events e JOIN session_tasks s ON e.task=s.task WHERE s.session=? AND e.kind='message' ORDER BY e.id DESC LIMIT 80").all(String(id)).reverse().map(row => JSON.parse(row.body));
  }
  history(id) {
    const rows=this.db.prepare("SELECT e.kind,e.body FROM events e JOIN session_tasks s ON e.task=s.task WHERE s.session=? AND e.kind IN ('message','result') ORDER BY e.id DESC LIMIT 32").all(String(id));
    const entries=[];let remaining=40000;
    for(const row of rows){
      const item=JSON.parse(row.body);
      const content=row.kind==='result'?'UNTRUSTED PREVIOUS TOOL OBSERVATION: '+require('./observation.cjs').observation({tool:item.tool,...item.result},2000,6000):String(item.text);
      if(row.kind==='message'&&item.role==='assistant'&&/<invoke_tool>|"tool"\s*:/.test(content))continue;
      const bounded=content.slice(0,8000);if(bounded.length>remaining)break;remaining-=bounded.length;
      if(bounded)entries.push({role:row.kind==='message'&&item.role==='assistant'?'assistant':'user',content:bounded});
      if(entries.length>=14||remaining<=0)break;
    }
    return entries.reverse();
  }
  clear() { this.db.exec('DELETE FROM workspace_items; DELETE FROM memory_context; DELETE FROM sessions; DELETE FROM session_tasks;'); }
}
module.exports = {Workspace};
