# Cloud Gaming on restricted networks

## Player support (live)

Cloud Gaming offers Automatic and Restricted network connection modes. The choice is saved on this browser and applies when the player opens. Automatic preserves the provider and Nyx ICE configuration. Restricted network passes `network=restricted` to the self-hosted Stratus embed; that player keeps only TURN TCP and TURN TLS URLs and sets `iceTransportPolicy: relay`. It preserves the issued short-lived credentials and never includes the server shared secret. If no compatible relay exists, it reports the problem through the existing authenticated parent cleanup path. Session ownership, provider quotas, deadlines and authentication remain unchanged.

This mode does not enable WebRTC when browser policy disables it, and does not guarantee connectivity when the relay address or protocol is blocked. A network can allow HTTPS websites while still rejecting TURN-over-TLS on the same port.

## Production snapshot, September 15, 2026

The initial inspection found TCP TURN but no TLS endpoint. The authorized release added `turns:turn.nyxlearning.org:443?transport=tcp`, a DNS-only A record, a publicly trusted certificate and automated renewal. HAProxy owns public TCP 443; Caddy HTTPS listens on loopback 8443, and coturn TLS on 5349. HTTP on 80 remains available for certificate challenges and website redirects. No secret values were printed. The user reports the same Chromebook works on another network, which points to a network-specific connection failure; no failing-network packet trace has been captured.

## TLS deployment

The client endpoint is `turns:turn.nyxlearning.org:443?transport=tcp` with a publicly trusted certificate and automated renewal. Its DNS record points directly to the relay, without the ordinary Cloudflare HTTP proxy. This endpoint is appended to the existing URL list; existing TCP/UDP URLs and the shared secret are preserved. Stratus continues issuing short-lived session credentials.

The shared-VPS arrangement was selected and deployed; a separate relay remains an alternative:

- A separate relay address/server can dedicate TCP 443 to coturn and leave Nyx's HTTPS listener untouched. This needs an available additional address/server.
- Sharing the existing VPS address requires an L4 TLS router in front of Caddy and coturn. Route the relay hostname to coturn's TLS listener and other hostnames to Caddy. Preserve the actual client address with a restricted, verified PROXY-protocol path into Caddy. This requires coordinated listener, firewall, certificate renewal and updater changes; simply changing coturn's port to 443 will conflict with Caddy.

Before a shared-listener rollout, validate the installed router/Caddy modules, certificate issuance and renewal, source-IP preservation, ordinary/custom-domain HTTPS, Wisp WebSockets, Socket.IO, Stratus signaling, TURN authentication and a real relay connection. Capture current listener configurations for rollback. Deploy only with explicit authorization for DNS/production changes. Never publish the shared secret or copy private environment files into the repository.

`deploy/render-caddy.mjs` reads `/etc/nyx/turn-domain` and `/etc/nyx/turn-shared-443` to preserve the arrangement across updates. `deploy/refresh-turn-router.sh` validates and refreshes HAProxy. `deploy/renew-turn-certificate.sh` installs the renewed relay certificate/key under `/etc/coturn/certs` with restricted permissions and restarts coturn. Certificate challenges use `/var/lib/nyx-turn-acme`, outside Nyx's private storage. Origin HTTPS uses HTTP/1.1 and HTTP/2; the Cloudflare edge remains independent. Initial listener activation must wait briefly for HAProxy readiness before deciding to roll back.

Verified staged hostname routing, source-IP preservation and spoofed-header rejection; live site/Stratus health, Wisp and Socket.IO handshakes; and an external browser data-channel echo plus decoded synthetic video with both peers using TLS relay candidates. Certbot's dry-run renewal passed. Full cloud gameplay on the affected Chromebook/network has not been verified.

Verification must include the affected Chromebook on the failing Wi-Fi, a selected relay candidate, actual video/audio/input, and a sustained session. A successful page load, TURN service status or relay candidate alone does not establish working gameplay.

## References

- [WebRTC transport requirements: TURN over TCP/TLS](https://www.rfc-editor.org/rfc/rfc8835.html)
- [WebRTC connection configuration](https://www.w3.org/TR/webrtc/)
