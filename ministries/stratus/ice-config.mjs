// Serialized into the browser player by launcher.mjs; keep this function self-contained.
export function cloudIceConfig(iceServers, restricted = false) {
  if (!restricted) return { iceServers };
  const relays = (Array.isArray(iceServers) ? iceServers : []).flatMap(server => {
    const urls = (Array.isArray(server?.urls) ? server.urls : [server?.urls]).filter(url =>
      typeof url === 'string' && (/^turns:[^?]+(?:\?transport=tcp)?$/i.test(url) || /^turn:[^?]+\?transport=tcp$/i.test(url))
    );
    return urls.length ? [{ ...server, urls }] : [];
  });
  if (!relays.length) throw new Error('No TCP or TLS relay is available for Restricted network mode.');
  return { iceServers: relays, iceTransportPolicy: 'relay' };
}
