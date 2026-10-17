# Tutsi hostnames

The owner requested `childsupport.donateyourboat.us` as a Tutsi hostname on 2026-09-17.

- FreeDNS record: A, subdomain `childsupport`, domain `donateyourboat.us`, destination `15.204.93.166`.
- Exact host routing and Caddy on-demand certificate authorization share `lib/tutsi-hostnames.mjs`.
- Tutsi root and crawler rules apply to both registered sibling hosts. Other hostnames retain Nyx routing.
- Authoritative FreeDNS now resolves the saved A record to the VPS. Public HTTPS and the Tutsi page were verified on 2026-09-17.
- Local HTTP Host checks with a normal browser User-Agent verified the new hostname serves Tutsi. Existing crawler decoy behavior applies to generic bot clients.
- Browser-based TURN remains dependent on WebRTC; this DNS alias does not change device capabilities.


## User-created FreeDNS hostnames (2026-09-23)

Open Tutsi Settings > Browser > Connect domain, or `/tutsi/connect-domain`.
Create an A record for the desired FreeDNS hostname pointing to `15.204.93.166`.
After DNS propagates, submit the full hostname on that page. Registration selects
Tutsi explicitly; simply pointing an unregistered hostname at the server retains
Nyx's existing automatic default. Then open `https://your-hostname/`.

The existing Caddy catch-all and loopback-only authorization endpoint issue HTTPS
on demand. Certificate issuance still requires public DNS and certificate-authority
validation (including any CAA restrictions). No second Caddy instance is needed.
Brand registration is immutable through this public form; existing Nyx domains,
disabled registrations and built-in hostnames cannot be reassigned. New hostnames
have their own browser storage; Firebase/provider authorized-domain requirements
may also apply to sign-in on a new origin. No arbitrary FreeDNS hostname has been
live-verified as part of the fixture tests.
