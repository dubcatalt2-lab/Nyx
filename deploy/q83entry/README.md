# Secure hostname entry

Dedicated entry gate for `sec.ridgewoodstem.org`. Any nonempty username is accepted; this is a shared access password, not an account identity. The existing N7X account system remains separate.

Run `npm ci`, `npm run build`, and `npm test` in this directory. `q19.js` is generated from `client.js` using javascript-obfuscator with RC4 strings, renamed identifiers and multiline output. No credential is included in either file. Obfuscation is not the access control.

The loopback service reads `/etc/nyx/q83entry.json`: a 16-byte hexadecimal salt, a 64-byte hexadecimal Node scrypt hash, and a random 32-byte hexadecimal signing key. The file must be owned by the service user and mode 0600. Never place it in this repository. Passwords are compared literally, without HTML decoding or Unicode normalization.

Caddy's exact-host route verifies every non-gate request before N7X or the desktop routes, including upgrades. Keep the explicit `route` order. Gate endpoints are served from loopback port 8193; all other gate URLs return 404. The service must never be exposed directly to the Internet, because it trusts Caddy's overwritten X-Real-IP for rate limits.

Each successful password submission authorizes one top-level page entry, which must happen within one minute. Reloading, opening another tab, or navigating to a fresh top-level page requires the password again, including for previously issued sessions. Browser-restored documents that do not make a network request are not a new gate verification. Fetch Metadata distinguishes top-level documents from embedded frames; HTML requests without that metadata also require a new entry.

The host-only Secure/HttpOnly/SameSite=Strict cookie still authorizes assets, API calls, embedded frames and upgrades for up to eight hours so an opened application continues working. It no longer grants repeat top-level entry. One-use entry permissions are in-memory and reset on service restart. Rotating the signing key invalidates all issued cookies. Rate limits are in-memory and reset on service restart. The username is not persisted. Changing the shared password should also rotate the signing key.

Run `node deploy/q83entry/test-entry.mjs` from the repository root for the one-use entry and Edge browser regression. It uses an isolated fixture password/configuration and the existing obfuscated `q19.js`; it does not read or modify production credentials. The browser fixture reconstructs Fetch Metadata because Playwright intercepts requests before Chromium adds those headers.

Deployment: service `/etc/systemd/system/q83entry.service`, runtime `/opt/nyx-q83entry`, Caddy route `/etc/caddy/sites-enabled/sec-ridgewood.caddy`. Existing N7X runtime is unchanged. Cloudflare proxy is supported. This exact hostname uses automatic HTTP-01 certificate issuance instead of the generic on-demand DNS-IP check. The proxied A record targets the VPS. Public HTTPS, unauthenticated route blocking, password login and authenticated homepage/health were verified. Do not remove the gate route while this hostname is published: the catch-all N7X host route would otherwise serve it without this gate.
