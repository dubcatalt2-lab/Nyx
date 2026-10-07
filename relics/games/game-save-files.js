const prefix = '__nyx_game_files_v1_';
const allowedDatabase = name => /^\/(?:userfs|idbfs|home\/web_user\/love)(?:\/|$)/.test(name);
const bytes = value => new TextEncoder().encode(value).length;

function encode(value) {
  if (value instanceof Date) return { type: 'date', value: value.toISOString() };
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    const data = value instanceof ArrayBuffer ? new Uint8Array(value) : new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    if (data.length > 190_000) throw Error('This game save exceeds the cloud size limit.');
    let binary = '';
    for (let index = 0; index < data.length; index += 8192) binary += String.fromCharCode(...data.subarray(index, index + 8192));
    return { type: value instanceof ArrayBuffer ? 'buffer' : 'bytes', value: btoa(binary) };
  }
  if (Array.isArray(value)) return { type: 'array', value: value.map(encode) };
  if (value && typeof value === 'object') return { type: 'object', value: Object.entries(value).map(([key, item]) => [key, encode(item)]) };
  return { type: 'scalar', value };
}

function decode(data) {
  if (data.type === 'date') return new Date(data.value);
  if (data.type === 'buffer' || data.type === 'bytes') {
    const array = Uint8Array.from(atob(data.value), char => char.charCodeAt(0));
    return data.type === 'buffer' ? array.buffer : array;
  }
  if (data.type === 'array') return data.value.map(decode);
  if (data.type === 'object') return Object.fromEntries(data.value.map(([key, item]) => [key, decode(item)]));
  if (data.type === 'scalar') return data.value;
  throw Error('Invalid game save data.');
}

function openDatabase(name, version, upgrade) {
  return new Promise((resolve, reject) => {
    const request = version ? indexedDB.open(name, version) : indexedDB.open(name);
    let settled = false;
    const fail = error => { if (settled) return; settled = true; clearTimeout(timeout); reject(error); };
    const timeout = setTimeout(() => fail(Error('Game storage is busy. Close other game tabs and retry.')), 4000);
    request.onupgradeneeded = () => {
      if (settled) { request.transaction.abort(); return; }
      try { upgrade?.(request.result); } catch (error) { request.transaction.abort(); fail(error); }
    };
    request.onerror = () => fail(request.error);
    request.onsuccess = () => {
      if (settled) { request.result.close(); return; }
      settled = true; clearTimeout(timeout); resolve(request.result);
    };
    request.onblocked = () => fail(Error('Game storage is busy. Close other game tabs and retry.'));
  });
}

export async function readGameFiles() {
  const files = {};
  if (!indexedDB.databases) return files;
  for (const { name } of await indexedDB.databases()) {
    if (!allowedDatabase(name || '')) continue;
    const db = await openDatabase(name);
    try {
      if (!db.objectStoreNames.contains('FILE_DATA')) continue;
      const rows = await new Promise((resolve, reject) => {
        const tx = db.transaction('FILE_DATA'), store = tx.objectStore('FILE_DATA');
        const result = [], request = store.openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;
          try { result.push({ key: encode(cursor.key), value: encode(cursor.value), keyPath: store.keyPath }); }
          catch (error) { reject(error); tx.abort(); return; }
          cursor.continue();
        };
        tx.oncomplete = () => resolve(result);
        tx.onabort = () => reject(tx.error || Error('Game save could not be read.'));
        tx.onerror = () => reject(tx.error);
      });
      for (const row of rows) {
        const id = JSON.stringify([name, row.key]);
        files[id] = { database: name, version: db.version, ...row };
      }
    } finally { db.close(); }
  }
  return files;
}

export function splitGameFiles(files) {
  if (!Object.keys(files).length) return {};
  const json = JSON.stringify(files);
  if (bytes(json) > 250_000) throw Error('This game save exceeds the cloud size limit. Your local progress is retained.');
  const chunks = {};
  let chunk = '', index = 0, size = 0;
  for (const char of json) {
    const length = bytes(char);
    if (size + length > 23000) { chunks[prefix + index++] = chunk; chunk = ''; size = 0; }
    chunk += char; size += length;
  }
  chunks[prefix + index] = chunk;
  return chunks;
}

export function joinGameFiles(storage) {
  const keys = Object.keys(storage).filter(key => key.startsWith(prefix)).sort((a, b) => Number(a.slice(prefix.length)) - Number(b.slice(prefix.length)));
  return keys.length ? JSON.parse(keys.map(key => storage[key]).join('')) : {};
}

export const isGameFileKey = key => key.startsWith(prefix);

export function gameFileTime(row) {
  const stamp = row?.value?.type === 'object' ? row.value.value.find(([key]) => key === 'timestamp')?.[1] : null;
  return stamp?.type === 'date' ? Date.parse(stamp.value) : 0;
}

export async function restoreGameFiles(files, shouldApply = () => true) {
  const groups = new Map();
  for (const row of Object.values(files)) {
    if (!allowedDatabase(row.database || '') || !Number.isSafeInteger(row.version) || row.version < 1 || row.version > 1000) throw Error('Invalid game database in cloud save.');
    const rows = groups.get(row.database) || [];
    rows.push(row); groups.set(row.database, rows);
  }
  for (const [name, rows] of groups) {
    if (!indexedDB.databases) throw Error('This browser cannot restore file-based cloud saves.');
    const decoded = rows.map(row => ({key: decode(row.key), value: row.deleted ? undefined : decode(row.value), deleted: row.deleted}));
    const existing = (await indexedDB.databases()).find(item => item.name === name);
    const db = await openDatabase(name, Math.max(existing?.version || 0, rows[0].version), database => {
      if (!database.objectStoreNames.contains('FILE_DATA')) database.createObjectStore('FILE_DATA', { keyPath: rows[0].keyPath });
    });
    try {
      if (!shouldApply()) return;
      await new Promise((resolve, reject) => {
        const tx = db.transaction('FILE_DATA', 'readwrite'), store = tx.objectStore('FILE_DATA');
        try { for (const row of decoded) {
          const key = row.key;
          if (row.deleted) { store.delete(key); continue; }
          const value = row.value;
          if (store.keyPath === null) store.put(value, key); else store.put(value);
        } } catch (error) { tx.abort(); reject(error); return; }
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error || Error('Game save could not be restored.'));
        tx.onerror = () => reject(tx.error);
      });
    } finally { db.close(); }
  }
}
