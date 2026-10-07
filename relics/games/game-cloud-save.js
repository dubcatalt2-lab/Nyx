import {readGameFiles, restoreGameFiles, splitGameFiles, joinGameFiles, isGameFileKey, gameFileTime} from './game-save-files.js';

const excluded = /^(?:nyx\.|drop\.|nook\.|tutsi\.|firebase:|__nyx_game_files_v1_)/;
const size = value => new TextEncoder().encode(value).length;
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const snapshot = () => Object.fromEntries(Object.keys(localStorage).filter(key => !excluded.test(key)).map(key => [key, localStorage.getItem(key)]));

function validate(storage) {
  const entries = Object.entries(storage);
  if (entries.length > 64 || size(JSON.stringify(storage)) > 275_000 || entries.some(([key, value]) => key.length > 160 || size(value) > 24_000)) {
    throw Error('This save is too large for cloud sync. Your local progress is retained.');
  }
}

export function createGameCloudSave({gameKey, request, current, status, frame}) {
  let stopped = false, started = false, timer = 0, busy = null;
  let uid = '', journalKey = '', localBaseline = {}, fileBaseline = {}, files = {}, owned = {}, acknowledged = {};
  const active = () => !stopped && current();
  const message = text => { if (active()) status(text); };
  function journal(pending) {
    if (journalKey) localStorage.setItem(journalKey, JSON.stringify({storage: owned, removed: Object.keys(acknowledged).filter(key => !(key in owned)), pending}));
  }
  async function start() {
    localBaseline = snapshot();
    fileBaseline = await readGameFiles();
    let result;
    try { result = await request('nyx:cloud-game-load', {gameKey}); }
    catch (error) { message(error.message); return; }
    if (!active()) return;
    uid = String(result.accountUid || '');
    if (!uid) { message('Sign in to sync game progress. Local saves remain on this device.'); return; }
    journalKey = 'nyx.gameCloud.pending.' + encodeURIComponent(uid) + '.' + encodeURIComponent(gameKey);
    acknowledged = result.storage || {};
    let pending;
    try { pending = JSON.parse(localStorage.getItem(journalKey) || 'null'); } catch {}
    owned = {...acknowledged};
    if (pending?.pending) {
      Object.assign(owned, pending.storage);
      for (const key of pending.removed || []) delete owned[key];
    }
    for (const [key, value] of Object.entries(pending?.storage || {})) {
      if (excluded.test(key)) continue;
      if (key in localBaseline && localBaseline[key] !== value) owned[key] = localBaseline[key];
      else if (!(key in localBaseline)) delete owned[key];
    }
    validate(owned);
    files = joinGameFiles(owned);
    if (pending) for (const [key, row] of Object.entries(files)) {
      if (fileBaseline[key] && gameFileTime(fileBaseline[key]) > gameFileTime(row)) files[key] = fileBaseline[key];
    }
    if (!active()) return;
    for (const [key, value] of Object.entries(owned)) if (!excluded.test(key)) localStorage.setItem(key, value);
    for (const key of pending?.pending ? pending.removed || [] : []) if (!excluded.test(key)) localStorage.removeItem(key);
    await restoreGameFiles(files, active);
    if (!active()) return;
    localBaseline = snapshot();
    fileBaseline = await readGameFiles();
    started = true;
    message(pending?.pending ? 'Cloud save pending — retrying…' : 'Cloud saves ready');
    timer = setInterval(() => void flush(), 5000);
    if (pending?.pending) await flush();
  }
  async function capture() {
    const now = snapshot();
    for (const [key, value] of Object.entries(now)) if (localBaseline[key] !== value) owned[key] = value;
    for (const key of Object.keys(localBaseline)) if (!(key in now)) delete owned[key];
    localBaseline = now;
    async function persist(window, depth = 0) {
      if (depth > 4) return;
      try {
        if (window.Module?.nyxPersistSaves) await window.Module.nyxPersistSaves();
        for (let index = 0; index < window.frames.length; index++) await persist(window.frames[index], depth + 1);
      } catch {}
    }
    if (frame?.contentWindow) await persist(frame.contentWindow);
    const nowFiles = await readGameFiles();
    for (const [key, row] of Object.entries(nowFiles)) if (!equal(row, fileBaseline[key])) files[key] = row;
    for (const key of Object.keys(fileBaseline)) if (!(key in nowFiles) && files[key]) files[key] = {...files[key], deleted: true};
    fileBaseline = nowFiles;
    for (const key of Object.keys(owned)) if (isGameFileKey(key)) delete owned[key];
    Object.assign(owned, splitGameFiles(files));
    validate(owned);
    journal(true);
  }
  async function performFlush() {
    try {
      await capture();
      const storage = Object.fromEntries(Object.entries(owned).filter(([key, value]) => acknowledged[key] !== value));
      const removed = Object.keys(acknowledged).filter(key => !(key in owned));
      if (!Object.keys(storage).length && !removed.length) { journal(false); return; }
      const sent = {...owned};
      message('Saving progress…');
      const result = await request('nyx:cloud-game-save', {gameKey, accountUid: uid, storage, removed});
      if (!result.saved) throw Error('Cloud save was not confirmed. Progress is kept on this device.');
      acknowledged = sent;
      journal(false);
      message('Progress saved to your account');
    } catch (error) { message('Cloud save pending: ' + error.message); }
  }
  function flush() {
    if (!started || stopped) return Promise.resolve();
    if (!busy) busy = performFlush().finally(() => { busy = null; });
    return busy;
  }
  const onHidden = () => { if (document.visibilityState === 'hidden') void flush(); };
  const onStorage = event => { if (event.key && !excluded.test(event.key)) void flush(); };
  const onOnline = () => void flush();
  document.addEventListener('visibilitychange', onHidden);
  window.addEventListener('storage', onStorage);
  window.addEventListener('online', onOnline);
  return {
    start,
    flush,
    stop() {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('online', onOnline);
      const final = flush();
      stopped = true;
      return final;
    }
  };
}
