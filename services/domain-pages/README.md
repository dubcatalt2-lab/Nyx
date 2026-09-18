# Domain pages

Manually managed domains serving real math lessons. Everyone sees the same pages; this service does not detect crawlers, conceal a second application, submit automated category requests, or promise an unblock.

## Local use

Run `node services/domain-pages/server.mjs` from the repository. Open **http://localhost:9092** to add a hostname and page title, preview lessons, remove domains, or download Caddy configuration. No DNS changes are needed to preview a page.

The admin panel binds only to loopback. It is private to users of the computer, rather than connected to Nyx accounts. Public page routing binds to loopback port 9093 for a reverse proxy. It serves registered hosts only and never exposes the admin endpoints. The registry survives restarts at `~/.nyx/domain-pages/domains.json`; set `DOMAIN_PAGES_DATA_DIR` to choose a persistent location. Run one service process per registry.

## VPS setup (not installed automatically)

1. Install this directory on the VPS and run it under a dedicated unprivileged service user. Give that user a writable persistent `DOMAIN_PAGES_DATA_DIR`. Both ports remain bound to loopback.
2. Access the admin through an SSH tunnel: `ssh -N -L 9092:127.0.0.1:9092 ubuntu@15.204.93.166`, then open localhost:9092. Do **not** put port 9092 behind a public reverse proxy. The admin deliberately has no public-login flow.
3. Add domains you control. Set each domain's A record to your VPS IPv4 address; remove stale conflicting AAAA records if present. Existing nameservers can stay in place.
4. Download the Caddy configuration, inspect it for collisions with existing sites, and import it in the existing Caddy configuration. The generated virtual hosts forward to loopback port 9093. Caddy obtains HTTPS certificates when DNS/challenge routing are valid. The existing Nyx/Tutsi/TURN hostnames are reserved and cannot be added.
5. Validate the full Caddy configuration before reloading. Adding/removing entries in this panel changes the registry immediately, but you must update/reload the Caddy configuration separately. Removing a registry entry stops its pages even if its Caddy block remains.
6. Check each public domain and HTTPS. Lightspeed has retired the public Archive lookup. Its Access Checker and AccessScan tools are available through the Filter Admin Portal with administrator-provided access. Ask the school IT administrator to check the domain and request review if its category is inaccurate. This service does not submit review requests. Review outcomes remain external; school policies may still block the site.

The service never changes DNS, installs certificates, or reloads production services by itself. Adding a hostname is not evidence of DNS ownership or connectivity. No DNS status or successful recategorization is claimed by the panel.

## Checks

`node scripts/test-domain-pages.mjs` checks persistence, registered-host routing, local-admin access restrictions, CSRF rejection, domain validation, escaped page content and Caddy output using temporary data. No external domains or accounts are changed.

## Learning site and textbook

The preview and every registered domain serve a course dashboard with 24 interactive skills organized into six suggested grade 7-12 courses, lessons, worked examples, generated questions, hints, full solutions and per-device progress. Browser storage is used only for practice counts; there is no classroom/teacher account integration. The UI takes structural inspiration from public student-practice interfaces and uses original branding and content.

`/textbook` serves the full 150-page book: 15 units with teaching plans, vocabulary, worked examples, vector visual models, guided and independent practice, applications, error discussion, unit review and answer keys (360 questions total). Use browser Print or the PDF download.

Build the PDF with `node scripts/build-learning-textbook.mjs` (requires the repository's Playwright development dependency and Chromium). It validates all page bodies fit above their footers and checks the generated PDF has exactly 150 pages. The result is written to `DOMAIN_PAGES_DATA_DIR/textbook.pdf` (default `~/.nyx/domain-pages/textbook.pdf`). For VPS installation, copy that generated PDF to the service's data directory after each textbook change; the service does not need Playwright at runtime. Source HTML remains available if no PDF has been built.

`node scripts/test-learning-site.mjs` checks answer parsing, generated math, textbook question coverage, practice retries, completion/persistence, hints/solutions, navigation, search and mobile layout. These checks use temporary data and do not modify the local domain registry.

Grade groupings are navigation guides, not a claim of full standards alignment. Grade 12 includes an explicitly labeled introductory calculus lesson. Existing lesson IDs and saved practice counts are retained; old foundational course links map to their new grade sections. The 150-page foundations textbook remains available alongside the expanded online lessons.

## Integrated owner dashboard and primary domain

The main server installs `integration.mjs`. The domain registry starts empty. Existing Nyx and Tutsi homepages stay in place until the owner explicitly assigns a hostname to StudyReady. Nyx is also available at `/nyx`. `/studyready` is an explicit preview route. No user-agent/content switching is used.

Owner Dashboard ? StudyReady uses the existing founder-only authentication and API helper. Domains/titles are stored transactionally in Firestore `nyxSiteSettings/studyready`, with a 30-second public-routing cache and immediate invalidation on save. GET/POST/DELETE `/api/owner-dashboard/studyready` and POST `/:hostname/check` manage the registry and test DNS. Only the configured founder can use them. Co-owners and staff are denied.

The VPS already has Caddy's on-demand TLS and hostname validation. Additional domains must point to the configured VPS IP; no nameserver transfer is needed. Adding a domain changes its application homepage once traffic reaches the VPS. Removing it restores existing application routing; it does not change DNS or delete certificates. Tutsi and TURN hostnames remain protected from reassignment.

The integrated PDF is `/var/lib/nyx/studyready/textbook.pdf`, overridable by `STUDYREADY_PDF_PATH`. It is separate from the standalone localhost registry. Copy the generated PDF there during deployment and preserve it across releases. The local-only port 9092 admin is not exposed on the public domain.
