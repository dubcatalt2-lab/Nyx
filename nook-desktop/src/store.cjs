const {DatabaseSync} = require('node:sqlite');
const {randomUUID} = require('node:crypto');
const redact = value => String(value).replace(/n_api_[A-Za-z0-9_-]+|sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]+/g, '[redacted]');
class Store {
  constructor(file) {
    this.db = new DatabaseSync(file);
    this.db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS tasks(id TEXT PRIMARY KEY, title TEXT, state TEXT, created INTEGER, updated INTEGER); CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, task TEXT, time INTEGER, kind TEXT, body TEXT); CREATE TABLE IF NOT EXISTS memories(id TEXT PRIMARY KEY, text TEXT, updated INTEGER);');
    this.db.prepare("UPDATE tasks SET state='interrupted' WHERE state NOT IN ('completed','failed','cancelled','interrupted')").run();
    this.workspace = new (require('./workspace.cjs').Workspace)(this.db, redact);
  }
  create(title) { const id = randomUUID(); this.db.prepare('INSERT INTO tasks VALUES(?,?,?,?,?)').run(id, redact(title).slice(0, 200), 'planning', Date.now(), Date.now()); return id; }
  state(id, state) { this.db.prepare('UPDATE tasks SET state=?,updated=? WHERE id=?').run(state, Date.now(), id); }
  event(task, kind, body) { const value = redact(JSON.stringify(body)); this.db.prepare('INSERT INTO events(task,time,kind,body) VALUES(?,?,?,?)').run(task || '', Date.now(), kind, value.length > 150000 ? JSON.stringify({truncated: true, preview: value.slice(0, 149000)}) : value); }
  tasks() { return this.db.prepare('SELECT * FROM tasks ORDER BY updated DESC LIMIT 100').all(); }
  events(task) { return this.db.prepare('SELECT * FROM events WHERE task=? ORDER BY id LIMIT 1000').all(task).map(row => ({...row, body: JSON.parse(row.body)})); }
  memories() { return this.workspace.memories(); }
  remember(text) { if (typeof text !== 'string' || !text.trim() || text.length > 4000) throw Error('Use 1–4000 characters.'); const id = randomUUID(); this.db.prepare('INSERT INTO memories VALUES(?,?,?)').run(id, redact(text), Date.now()); return id; }
  forget(id) { this.db.prepare('DELETE FROM memories WHERE id=?').run(id); this.db.prepare('DELETE FROM memory_context WHERE id=?').run(id); }
  clear() { this.workspace.clear(); this.db.exec('DELETE FROM events; DELETE FROM tasks; DELETE FROM memories; VACUUM;'); }
  close() { this.db.close(); }
}
module.exports = {Store, redact};
