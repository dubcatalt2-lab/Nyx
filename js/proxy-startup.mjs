const pending = new Map();

// A failed script element must not turn every subsequent navigation into a
// promise waiting for a load event that has already happened.
export function loadProxyScript(src, ready, { timeoutMs = 20000 } = {}) {
  if (ready()) return Promise.resolve();
  const url = new URL(src, location.href).href;
  if (pending.has(url)) return pending.get(url);
  const attempt = () => new Promise((resolve, reject) => {
    if (ready()) return resolve();
    const node = document.createElement('script');
    node.src = src; node.async = false;
    const finish = error => {
      clearTimeout(timer); node.onload = null; node.onerror = null;
      if (error) { node.remove(); reject(error); }
      else resolve();
    };
    const timer = setTimeout(() => finish(new Error('The browser engine took too long to load. Please retry.')), timeoutMs);
    node.onload = () => finish(ready() ? null : new Error('The browser engine returned an incomplete script.'));
    node.onerror = () => finish(Object.assign(new Error('The browser engine could not load. Please retry.'), { retryable: true }));
    document.head.append(node);
  });
  const task = attempt().catch(error => {
    if (!error.retryable) throw error;
    return attempt(); // One retry for a failed static GET, shared by waiting tabs.
  }).finally(() => { if (pending.get(url) === task) pending.delete(url); });
  pending.set(url, task);
  return task;
}

export function waitForProxyController(instance, timeoutMs = 20000) {
  let timer;
  return Promise.race([
    instance.wait(),
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('The browser controller took too long to start. Please retry.')), timeoutMs); })
  ]).finally(() => clearTimeout(timer));
}
