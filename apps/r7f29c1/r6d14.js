(() => {
  const form = document.querySelector("form");
  const field = form.querySelector("input");
  const button = form.querySelector("button");
  const stage = document.querySelector("iframe");
  const status = document.querySelector('[role="status"]');
  function report(message) { status.textContent = message; status.setAttribute("aria-label", message); }
  let connection;
  function relayAddress() {
    try {
      const selection = parent.nyxAlternateRelayAddress?.();
      if (selection) return selection;
    } catch {}
    const configured = globalThis.english_RUNTIME_CONFIG?.wispUrl;
    if (configured) return configured;
    const backend = document.querySelector('meta[name="nyx-static-backend"]')?.content;
    const endpoint = new URL(backend || location.origin);
    if (!/^https?:$/.test(endpoint.protocol)) throw Error('Invalid backend address.');
    return `${endpoint.protocol === "https:" ? "wss:" : "ws:"}//${endpoint.host}/resources/live/`;
  }
  async function prepare() {
    if (!navigator.serviceWorker || !globalThis.isSecureContext) throw Error("Open Nyx over HTTPS or localhost to use this view.");
    const registration = await navigator.serviceWorker.register("/apps/r7f29c1/r21e8.js", {scope: "/apps/r7f29c1/"});
    const worker = registration.installing || registration.waiting || registration.active;
    if (worker?.state !== "activated") await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("The page worker did not activate.")), 15000);
      const changed = () => {
        if (worker.state === "activated") {clearTimeout(timer); worker.removeEventListener("statechange", changed); resolve();}
        else if (worker.state === "redundant") {clearTimeout(timer); reject(Error("The page worker could not start."));}
      };
      worker.addEventListener("statechange", changed); changed();
    });
    connection ||= new W1I41.W1I41Connection("/assets/vendor/r7f29c1/8hF6n.js");
    const relay = relayAddress();
    if (new URL(relay).pathname === '/api/tutsi-relay/socket/') {
      await connection.setManualzIWyC(`
        const {installHttpRelaySocket} = await import('/apps/tutsi/http-relay.mjs');
        installHttpRelaySocket();
        const {default: Transport} = await import('/assets/vendor/r7f29c1/index-1OTY61e4.min.mjs');
        return [Transport, '/assets/vendor/r7f29c1/index-1OTY61e4.min.mjs'];
      `, [{WeZaN: relay}]);
    } else {
      await connection.setzIWyC('/assets/vendor/r7f29c1/index-1OTY61e4.min.mjs', [{WeZaN: relay}]);
    }
  }
  form.addEventListener("submit", async event => {
    event.preventDefault();
    let destination;
    try {
      const raw = field.value.trim();
      destination = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
      if (!/^https?:$/.test(destination.protocol) || destination.username || destination.password) throw Error("Enter an http or https website address.");
    } catch (error) {report(error.message); return;}
    button.disabled = true; status.hidden = false; report("Opening website...");
    try {
      await prepare();
      stage.hidden = false;
      stage.src = __u22$config.prefix + __u22$config.encodeUrl(destination.href);
      report("Website opened.");
    } catch (error) {report(error.message || "The alternate engine could not start.");}
    finally {button.disabled = false;}
  });
  button.disabled = false;
})();
