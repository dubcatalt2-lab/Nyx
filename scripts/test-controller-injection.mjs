import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { repositoryControllerInjection } from '../lib/controller-injection.mjs';
import { rewriteRuntimeNames } from './build-runtime-names.mjs';

const source = repositoryControllerInjection();
assert(source.includes('injectstudyj3t()'), 'Repository implementation, not npm replacement');
assert(!source.includes('sourceMappingURL'));
const variants = [['source', source, false]];
if (process.argv.includes('--compiled')) {
  const root = process.env.NYX_TEST_STATIC_ROOT || 'dist';
  const { aliases } = JSON.parse(await readFile(root + '/proxy-assets.json', 'utf8'));
  variants.push(['compiled', await readFile(root + aliases['/controller/controller.inject.js'], 'utf8'), true]);
}
for (const [name, code, compiled] of variants) {
  const hook = value => compiled ? rewriteRuntimeNames(value) : value;
  const listeners = [], sent = [], clients = [];
  class CookieJar {
    cookies = []; load(value) { this.cookies = value; }
    dump() { return this.cookies; } clear() { this.cookies = []; }
    setCookies(value) { this.cookies.push(value); }
  }
  class Client {
    constructor(global, options) { this.options = options; clients.push(this); }
    hook() { this.hooked = true; }
  }
  class Port { postMessage() {} start() {} }
  const clientKey = Symbol('client');
  const context = {
    MessagePort: Port, MessageChannel: class { port1 = new Port(); port2 = new Port(); },
    navigator: { serviceWorker: { controller: { postMessage: value => sent.push(value) }, addEventListener: (_, fn) => listeners.push(fn) } },
    URL, console, Uint8Array, atob, WASM: 'AA==',
    [hook('$scramjet')]: { CookieJar, [hook('SCRAMJETCLIENT')]: clientKey,
      [hook('ScramjetClient')]: Client, setWasm: bytes => assert.equal(bytes.length, 1), Tap: {} },
  };
  context.self = context; context.window = context; context.parent = context;
  vm.createContext(context); vm.runInContext(code, context);
  const controller = context[hook('$scramjetController')];
  assert.equal(typeof controller.load, 'function');
  const init = { cookies: [], prefix: new URL('https://nyx.test/4otig/owner-a/'),
    yieldGetInjectScripts() {}, sjconfig: {}, config: {}, initHeaders: [], history: [] };
  controller.load(init);
  assert(clients[0].hooked, name + ': fresh injection hooks the client');
  assert.equal(sent.length, 1);
  listeners[0]({ data: { $controller$setCookie: { controllerId: 'owner-b', cookies: [{ url: 'https://site.test', cookie: 'wrong=1' }] } } });
  assert.equal(clients[0].options.context.cookieJar.cookies.length, 0, 'Other controller cookies remain isolated');
  listeners[0]({ data: { $controller$setCookie: { controllerId: 'owner-a', id: 'ack', cookies: [{ url: 'https://site.test', cookie: 'right=1' }] } } });
  assert.equal(clients[0].options.context.cookieJar.cookies[0], 'right=1');
  assert.equal(sent[1].$sw$setCookieDone.id, 'ack');
  let synced = false;
  context[clientKey] = { syncDocumentInit(value) { synced = value.cookies === init.cookies; } };
  controller.load(init); assert(synced); assert.equal(clients.length, 1);
  console.log('PASS ' + name + ' repository controller: engine exports, fresh/repeated injection, transport and cookie isolation');
}
