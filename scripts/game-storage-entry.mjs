import * as fallback from 'fake-indexeddb';

if (globalThis.origin === 'null') {
  for (const [name, value] of Object.entries(fallback)) {
    if (name === 'indexedDB' || name.startsWith('IDB')) Object.defineProperty(globalThis, name, {configurable:true,writable:true,value});
  }
}
