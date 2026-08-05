# Nyx IP Bans

The Owner Dashboard's **IP bans** control is available to the Owner, Co-owner, and Admin roles. It stores exact IPv4 or IPv6 addresses in the server-only Firestore collection `nyxIpBans`, records each add, update, and removal in `nyxAuditLog`, and rejects an attempt to block the IP address currently operating the dashboard.

Nyx records `lastSeenIp` and `lastSeenIpAt` on each authenticated account's activity heartbeat and session-start event. Authorized staff can see this last observed address in the user drawer and can use **Disable + block IP** for a manageable account. The action disables the Firebase account, revokes its sessions, and creates or updates the matching IP ban. It does not create a historical IP log; an account receives a value only after it next performs authenticated activity.

The Express application checks the list before handling each request. Ban-list reads are cached for up to 30 seconds and are invalidated immediately by a local add or removal. It fails open if Firebase is temporarily unavailable, so a Firebase outage cannot take down the entire site.

## Production IP forwarding

On Netlify, `netlify/functions/api.mjs` enables `NYX_TRUST_PROXY` by default so the application can use Netlify's `x-nf-client-connection-ip` header, then Cloudflare's `cf-connecting-ip` header, and finally `x-forwarded-for`. A self-hosted deployment must set `NYX_TRUST_PROXY=true` only when its reverse proxy replaces these headers; otherwise leave it unset so a direct client cannot spoof an address.

## Required Cloudflare full-site rule

Netlify serves static Nyx files before the Express function executes. Therefore the Owner Dashboard ban list protects Nyx function and server traffic, but a matching Cloudflare rule is required to block the complete `nyxlearning.org` site at the edge.

Create an IP List named `nyx_ip_bans` in the `nyxlearning.org` Cloudflare account. Add the exact addresses shown in Owner Dashboard, then create a custom WAF rule with:

```text
Expression: ip.src in $nyx_ip_bans
Action: Block
```

Keep the Cloudflare list synchronized with the Owner Dashboard list when adding or removing an address. Nyx deliberately does not store a Cloudflare API token or mutate the firewall automatically.

The public Railway Wisp endpoint is outside the Cloudflare zone. A Cloudflare rule prevents people from loading Nyx itself, but direct WebSocket abuse needs an equivalent Railway-side network policy if it becomes a concern.
