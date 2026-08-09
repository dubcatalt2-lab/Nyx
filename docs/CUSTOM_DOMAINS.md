# Nyx self-service custom domains

Nyx supports self-service A-record hostnames on the OVH deployment through Caddy On-Demand TLS. A hostname is authorized before Caddy requests a certificate; never enable unrestricted On-Demand TLS.

## Server requirements

- `NYX_CUSTOM_HOST_IPS` contains the comma-separated public IPv4/IPv6 addresses that users may point at Nyx. For the current OVH server, set it to the VPS public IPv4 address.
- Firebase Admin is configured. Verified hostnames are stored server-side in `nyxCustomHostnames`; browser access is denied by `firestore.rules`.
- The VPS build leaves `WISP_URL` unset so the browser uses the current hostname's same-origin `/wisp/` endpoint.
- Caddy uses `GET /api/custom-hostnames/allow?domain=...` as its fast database-backed authorization endpoint.

## User flow

1. Open `/connect-domain` on the main Nyx hostname.
2. Create a FreeDNS `A` record pointing the full hostname to the displayed VPS address.
3. Paste the full hostname into the connection form.
4. Nyx resolves its public A/AAAA records. At least one must exactly match `NYX_CUSTOM_HOST_IPS`.
5. Nyx stores the verified hostname. The first HTTPS visit causes Caddy to obtain its certificate automatically.

Registration is public but same-origin, limited to 10 verification attempts per source network per hour, limited to exact hostnames, and does not accept ports, paths, IP literals, or wildcard names. Caddy's authorization request performs only a Firestore document lookup; DNS is checked during registration, not during the TLS handshake.

## Caddy configuration

`deploy/caddy/nyx.Caddyfile.template` is the source configuration. Replace `__NYX_DOMAIN__` with the primary hostname and install it as `/etc/caddy/Caddyfile`. Keep the Cloudflare proxy ranges current from Cloudflare's published IPv4 and IPv6 lists.

Before reloading:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

The proxy overwrites `CF-Connecting-IP` with Caddy's trusted `{client_ip}` value. This preserves Nyx IP logging and bans without trusting a visitor-supplied header on direct FreeDNS connections.

## Limitations

- Only A/AAAA hostnames that resolve directly to the configured VPS address can be registered. A hostname proxied through a different CDN will not pass verification.
- Firebase browser storage and sign-in state are isolated per hostname. Users may need to sign in again on a custom hostname.
- Cloudflare WAF rules for `nyxlearning.org` do not protect direct FreeDNS aliases. Express's IP-ban guard still covers their HTTP and Wisp traffic.
- Certificate authorities impose issuance limits. Do not remove the registration rate limit or Caddy authorization endpoint.
