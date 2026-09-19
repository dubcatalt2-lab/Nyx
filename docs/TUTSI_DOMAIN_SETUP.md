# Tutsi hostnames

The owner requested `childsupport.donateyourboat.us` as a Tutsi hostname on 2026-09-17.

- FreeDNS record: A, subdomain `childsupport`, domain `donateyourboat.us`, destination `15.204.93.166`.
- Exact host routing and Caddy on-demand certificate authorization share `lib/tutsi-hostnames.mjs`.
- Tutsi root and crawler rules apply to both registered sibling hosts. Other hostnames retain Nyx routing.
- Authoritative FreeDNS now resolves the saved A record to the VPS. Public HTTPS and the Tutsi page were verified on 2026-09-17.
- Local HTTP Host checks with a normal browser User-Agent verified the new hostname serves Tutsi. Existing crawler decoy behavior applies to generic bot clients.
- Browser-based TURN remains dependent on WebRTC; this DNS alias does not change device capabilities.
