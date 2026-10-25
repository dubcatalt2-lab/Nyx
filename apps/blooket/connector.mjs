import { supportedEntries } from './supported.mjs';
export function createBookmarklet(origin, entries, runtime) {
  entries = supportedEntries(entries);
  const target = new URL(origin);
  if (target.origin !== origin || (target.protocol !== 'https:' && !['http://localhost:8080', 'http://127.0.0.1:' + target.port].includes(origin))) throw Error('Open setup on a secure Nyx site.');
  // Pinned action functions travel with the bookmark, avoiding remote script
  // injection and eval on Blooket. The bridge only receives an action path.
  const actions = entries.filter(entry => entry.category !== 'interfaces' && entry.code).map(entry => {
    if (!/^[a-zA-Z0-9/-]+\.js$/.test(entry.path)) throw Error('Invalid tool path');
    return `${JSON.stringify(entry.path)}:async function(setInterval,setTimeout,resolveBlooketState,resolveBlooketEffect,resolveBlooketGame,resolveBlooketScene,resolveBlooketFiber,onBlooketCleanup,runBlooketQuestionTool,fetch,prompt,alert,confirm,clearInterval,clearTimeout,readBlooketNumber,resolveBlooketProps){const iframe={contentWindow:window};return await ${entry.code};}`;
  }).join(',');
  return 'javascript:' + encodeURIComponent(`void function(){window[Symbol.for("nyx.blooket.setup.v1")]={origin:${JSON.stringify(origin)},actions:{${actions}},contracts:${JSON.stringify(Object.fromEntries(entries.filter(e=>e.category!=='interfaces').map(e=>[e.path,e.requirements||[]])))}};${runtime}\n}()`);
}

export function connectWorkspace({ onStatus, onError, onDisconnect }) {
  const parameters = new URLSearchParams(location.hash.slice(1));
  const channel = parameters.get('bridge'), origin = parameters.get('origin');
  if (!channel) return null;
  window.history.replaceState(null, '', location.pathname + location.search);
  let officialOrigin = false;
  try { const url = new URL(origin); officialOrigin = url.origin === origin && url.protocol === 'https:' && !url.port && (url.hostname === 'blooket.com' || url.hostname.endsWith('.blooket.com')); } catch {}
  if (!/^[a-f0-9]{48}$/.test(channel) || !officialOrigin || !window.opener) {
    onError('The connection could not be opened. Click the bookmarklet on the official Blooket tab again. Your br00ser must allow the two tabs to communicate.'); return null;
  }
  const source = window.opener, pending = new Map();
  let connected = false, closed = false, lastSeen = Date.now();
  const send = (type, extra = {}) => source.postMessage({ protocol:'nyx-blooket-v1', channel, type, ...extra }, origin);
  function close(notify = true) {
    if (closed) return;
    if (notify) send('disconnect'); closed = true; connected = false; clearInterval(timer);
    window.removeEventListener('message', receive); window.removeEventListener('pagehide', unload);
    for (const task of pending.values()) { clearTimeout(task.timer); task.reject(Error('Blooket disconnected.')); } pending.clear();
    onDisconnect();
  }
  function receive(event) {
    const data = event.data;
    if (closed || event.source !== source || event.origin !== origin || data?.protocol !== 'nyx-blooket-v1' || data.channel !== channel) return;
    if (data.type === 'status') {
      if (data.connectorVersion !== 11) { close(); onError('This bookmark is out of date. Save Connect to Nyx again, then click the new bookmark in Blooket.'); return; }
      if (data.host !== new URL(origin).hostname || data.revision !== 'c322469ebbd192b6731480af76b1ac0a3d4a7b22') return;
      lastSeen = Date.now(); connected = true; onStatus({ host:data.host, path:String(data.path || '/').slice(0,200) });
    } else if (data.type === 'result') {
      const task = pending.get(data.id); if (!task) return;
      pending.delete(data.id); clearTimeout(task.timer); data.error ? task.reject(Error(String(data.error))) : task.resolve(data);
    } else if (data.type === 'action-error') onError('Running tool stopped with an error: ' + String(data.error || '').slice(0,300));
    else if (data.type === 'disconnected') close(false);
  }
  const unload = () => close();
  window.addEventListener('message', receive); window.addEventListener('pagehide', unload);
  const timer = setInterval(() => {
    if (source.closed || Date.now() - lastSeen > (connected && document.visibilityState === 'hidden' ? 90000 : 12000)) {
      close(); onError('Blooket connection ended. Return to its tab and click the bookmarklet again after the page has loaded.');
    } else send(connected ? 'ping' : 'hello');
  }, 2000);
  send('hello');
  return {
    close,
    focus: () => { if (!closed) source.focus(); },
    request(type, path) {
      if (!connected || closed) return Promise.reject(Error('Connect your Blooket tab first.'));
      return new Promise((resolve, reject) => {
        const id = crypto.randomUUID();
        const timer = setTimeout(() => { pending.delete(id); reject(Error('Blooket has not finished this action. Check its tab for a prompt. No action was retried.')); }, 60000);
        pending.set(id, { resolve, reject, timer }); send(type, { id, path });
      });
    }
  };
}
