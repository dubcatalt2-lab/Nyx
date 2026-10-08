export const LUNA_URL = 'https://luna.loan/';

function check(frame, signal) {
  if (signal?.aborted || !frame.isConnected) throw new DOMException('Cancelled', 'AbortError');
}

function settings() {
  const read = key => { try { return localStorage.getItem(key) || ''; } catch { return ''; } };
  const transport = read('nyx.transport').replace(/^"|"$/g, '');
  return {
    transport: !transport || transport === 'auto' || /^libcurl/i.test(transport) ? 'libcurl' : transport === 'wisp' ? 'wisp' : 'epoxy',
    httpBridge: read('nyx.httpBridge') !== 'false', relay: read('nyx.wispUrl'), autoRelay: true,
    adBlock: read('nyx.popupProtection') !== 'false', popupBlock: true, downloadBlock: true
  };
}

export async function launchLunaConnection(frame, signal) {
  check(frame, signal);
  // Cloud Gaming may be nested inside Games, so the host is not always parent.
  let owner = window;
  for (let depth = 0; depth < 8; depth++) {
    try {
      if (typeof owner.nyxLaunchGameFrame === 'function') {
        const result = await owner.nyxLaunchGameFrame(frame, LUNA_URL, {forceProxy: true, signal});
        check(frame, signal);
        if (!result?.managed) throw new Error('Luna could not start its connection.');
        return;
      }
      if (owner.parent === owner) break;
      owner = owner.parent;
      void owner.location.origin;
    } catch (error) {
      if (error.name === 'SecurityError') break;
      throw error;
    }
  }

  const {loadConnectionScript} = await import('/js/intercession-startup.mjs');
  check(frame, signal);
  if (!globalThis.__NYX_RUNTIME_CONFIG__) {
    await loadConnectionScript('/runtime-config.js', () => !!globalThis.__NYX_RUNTIME_CONFIG__);
  }
  check(frame, signal);
  const {explore, closeWorkspace} = await import('/chapels/tutsi/intercession.mjs');
  check(frame, signal);
  const cancel = () => closeWorkspace(frame);
  signal?.addEventListener('abort', cancel, {once: true});
  try {
    await explore(LUNA_URL, settings(), frame);
    check(frame, signal);
  } catch (error) {
    signal?.removeEventListener('abort', cancel);
    cancel();
    throw error;
  }
}
