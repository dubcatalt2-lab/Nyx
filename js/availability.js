(() => {
  let failures = 0,
    firstFailure = 0,
    relayFailures = 0,
    relayUrl = "",
    getRelay = null,
    onRelayFailure = null,
    busy = false,
    relayTimer = null,
    cancelProbe = null,
    relayGeneration = 0;
  let hostDown = false,
    relayDown = false;
  function render() {
    document.getElementById("n7xAvailabilityWarning")?.remove();
  }
  function recordHealth(ok) {
    if (navigator.onLine === false) {
      reset();
      render();
      return;
    }
    if (ok) {
      const recovered = hostDown;
      failures = 0;
      firstFailure = 0;
      hostDown = false;
      if (recovered) scheduleRelay(0);
    } else {
      if (!failures) firstFailure = Date.now();
      failures++;
      if (failures >= 3 && Date.now() - firstFailure >= 10000) hostDown = true;
    }
    render();
  }
  function reset() {
    failures = 0;
    firstFailure = 0;
    hostDown = false;
    relayFailures = 0;
    relayDown = false;
  }
  function probe(url) {
    return new Promise((resolve) => {
      let socket,
        timer,
        settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cancelProbe = null;
        if (socket) {
          socket.onopen = socket.onerror = socket.onclose = null;
          try {
            socket.close();
          } catch {}
        }
        resolve(ok);
      };
      cancelProbe = () => done(null);
      timer = setTimeout(() => done(false), 10000);
      try {
        socket = new WebSocket(url);
        socket.onopen = () => done(true);
        socket.onerror = socket.onclose = () => done(false);
      } catch {
        done(false);
      }
    });
  }
  function scheduleRelay(delay) {
    clearTimeout(relayTimer);
    relayTimer = setTimeout(() => void checkRelay(), delay);
  }
  function resumeRelay() {
    relayGeneration++;
    cancelProbe?.();
    clearTimeout(relayTimer);
    relayFailures = 0;
    if (!document.hidden && navigator.onLine !== false) scheduleRelay(0);
  }
  async function checkRelay() {
    if (busy || document.hidden || navigator.onLine === false || hostDown || !getRelay) return;
    const selected = getRelay();
    if (!/^wss?:\/\//i.test(selected.url)) {
      relayUrl = "";
      relayFailures = 0;
      relayDown = false;
      render();
      scheduleRelay(30000);
      return;
    }
    if (relayUrl !== selected.url) {
      relayUrl = selected.url;
      relayFailures = 0;
      relayDown = false;
      render();
    }
    const generation = relayGeneration;
    busy = true;
    try {
      const ok = await probe(selected.url);
      if (
        generation !== relayGeneration ||
        ok === null ||
        document.hidden ||
        navigator.onLine === false
      )
        return;
      if (getRelay().url !== selected.url) {
        relayFailures = 0;
        relayDown = false;
        render();
        scheduleRelay(0);
        return;
      }
      relayFailures = ok ? 0 : relayFailures + 1;
      relayDown = ok ? false : relayDown || relayFailures >= 3;
      if (!ok && relayFailures >= 3) await onRelayFailure?.(selected.url);
      render();
      scheduleRelay(ok ? 30000 : 5000);
    } finally {
      busy = false;
    }
  }
  window.NyxAvailability = {
    recordHealth,
    start(resolveRelay, recoverRelay) {
      if (getRelay) return;
      getRelay = resolveRelay;
      onRelayFailure = recoverRelay;
      void checkRelay();
      addEventListener("offline", () => {
        reset();
        resumeRelay();
        render();
      });
      addEventListener("online", () => {
        reset();
        resumeRelay();
        render();
      });
      document.addEventListener("visibilitychange", resumeRelay);
    },
  };
})();
