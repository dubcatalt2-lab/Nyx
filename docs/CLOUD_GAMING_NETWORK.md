# Cloud Gaming on restricted networks

## Local player support

Cloud Gaming offers Automatic and Restricted network connection modes. The choice is saved on this browser and applies when the player opens. Automatic preserves the provider and Nyx ICE configuration. Restricted network passes `network=restricted` to the self-hosted Stratus embed; that player keeps only TURN TCP and TURN TLS URLs and sets `iceTransportPolicy: relay`. It preserves the issued short-lived credentials and never includes the server shared secret. If no compatible relay exists, it reports the problem through the existing authenticated parent cleanup path. Session ownership, provider quotas, deadlines and authentication remain unchanged.

This mode does not enable WebRTC when browser policy disables it, and does not guarantee connectivity when the relay address or protocol is blocked. A network can allow HTTPS websites while still rejecting TURN-over-TLS on the same port.

## Production snapshot, September 15, 2026

Read-only configuration inspection confirms Nyx has TURN TCP configured, but no `turns:` URL, TLS listener port or TLS certificate configured. No secret values were printed. Caddy owns the public HTTPS listener. The user reports the same Chromebook works on another network, which points to a network-specific connection failure; no failing-network packet trace has been captured.

## Proposed TLS deployment (not performed)

The intended client endpoint is `turns:turn.nyxlearning.org:443?transport=tcp` with a publicly trusted certificate and automated renewal. Its DNS record must point directly to the relay, without the ordinary Cloudflare HTTP proxy. Add this endpoint to the existing URL list; preserve existing TCP/UDP URLs and the shared secret. Continue issuing short-lived session credentials through Stratus.

Two hosting arrangements are possible:

- A separate relay address/server can dedicate TCP 443 to coturn and leave Nyx's HTTPS listener untouched. This needs an available additional address/server.
- Sharing the existing VPS address requires an L4 TLS router in front of Caddy and coturn. Route the relay hostname to coturn's TLS listener and other hostnames to Caddy. Preserve the actual client address with a restricted, verified PROXY-protocol path into Caddy. This requires coordinated listener, firewall, certificate renewal and updater changes; simply changing coturn's port to 443 will conflict with Caddy.

Before a shared-listener rollout, validate the installed router/Caddy modules, certificate issuance and renewal, source-IP preservation, ordinary/custom-domain HTTPS, Wisp WebSockets, Socket.IO, Stratus signaling, TURN authentication and a real relay connection. Capture current listener configurations for rollback. Deploy only with explicit authorization for DNS/production changes. Never publish the shared secret or copy private environment files into the repository.

Verification must include the affected Chromebook on the failing Wi-Fi, a selected relay candidate, actual video/audio/input, and a sustained session. A successful page load, TURN service status or relay candidate alone does not establish working gameplay.

## References

- [WebRTC transport requirements: TURN over TCP/TLS](https://www.rfc-editor.org/rfc/rfc8835.html)
- [WebRTC connection configuration](https://www.w3.org/TR/webrtc/)
