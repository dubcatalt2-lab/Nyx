# Nyx self-service custom domains

Nyx supports self-service A-record hostnames on the OVH deployment through Caddy On-Demand TLS. A hostname is authorized before Caddy requests a certificate; never enable unrestricted On-Demand TLS.

## Server requirements

- `NYX_CUSTOM_HOST_IPS` contains the comma-separated public IPv4/IPv6 addresses that users may point at Nyx. For the current OVH server, set it to the VPS public IPv4 address.
- Firebase Admin is configured. Hostnames checked through the optional connection form are stored server-side in `nyxCustomHostnames`; browser access is denied by `firestore.rules`.
- The VPS build leaves `WISP_URL` unset so the browser uses the current hostname's same-origin `/wisp/` endpoint.
- Caddy uses `GET /api/custom-hostnames/allow?domain=...` as its authorization endpoint. Known hostnames use the indexed Firestore record; an unknown hostname is accepted automatically only when its current A/AAAA records resolve directly to `NYX_CUSTOM_HOST_IPS`.

## User flow

1. Open `/connect-domain` on the main Nyx hostname to copy the VPS address, or use the published Nyx A-record destination.
2. Create a FreeDNS `A` record pointing the full hostname to that VPS address.
3. Wait for public DNS to update, then open the complete hostname with `https://`.
4. Caddy asks Nyx about the unknown hostname. Nyx requires at least one current A/AAAA record to exactly match `NYX_CUSTOM_HOST_IPS`, then Caddy obtains the certificate automatically.

The connection form is now an optional preflight check that can warm the authorization cache and store the verified hostname. It is not required, and neither the user nor the owner has to add or approve a domain before its first visit.

The optional preflight is public but same-origin, limited to 10 verification attempts per source network per hour, limited to exact hostnames, and does not accept ports, paths, IP literals, or wildcard names. The Caddy authorization URL accepts only loopback requests addressed to a loopback host. Automatic authorization shares concurrent checks and uses a bounded cache: successful decisions last five minutes and failed decisions last 30 seconds. Explicitly disabled Firestore records remain denied.

## Caddy configuration

`deploy/caddy/nyx.Caddyfile.template` is the source configuration. Replace `__NYX_DOMAIN__` with the primary hostname and install it as `/etc/caddy/Caddyfile`. Keep the Cloudflare proxy ranges current from Cloudflare's published IPv4 and IPv6 lists.

Before reloading:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

The proxy overwrites `CF-Connecting-IP` with Caddy's trusted `{client_ip}` value. This preserves Nyx IP logging and bans without trusting a visitor-supplied header on direct FreeDNS connections.

## Limitations

- Only A/AAAA hostnames that resolve directly to the configured VPS address can be connected automatically. A hostname proxied through a different CDN will not pass verification.
- Firebase browser storage and sign-in state are isolated per hostname. Users may need to sign in again on a custom hostname.
- Cloudflare WAF rules for `nyxlearning.org` do not protect direct FreeDNS aliases. Express's IP-ban guard still covers their HTTP and Wisp traffic.
- Certificate authorities impose issuance limits. Do not remove Caddy's authorization endpoint or its exact-IP requirement.
