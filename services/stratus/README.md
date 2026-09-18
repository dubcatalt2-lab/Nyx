# Nyx Stratus service

This directory runs the optional Cloud Gaming backend as a separate, loopback-only process. It is not bundled into browser code and no API key belongs in Git.

## Source and license

`upstream/` is an unmodified snapshot of [`x8rr/stratus-api`](https://github.com/x8rr/stratus-api) at commit `bd760513ce7616e955181dfd18017e2a6c278e3c`. The upstream project is licensed under AGPL-3.0; its license is preserved in `UPSTREAM-LICENSE`.

`launcher.mjs` verifies the pinned files, writes a generated runtime copy, and applies Nyx's deployment hardening there. It also updates the pinned embed client's obsolete `/api/cloud/embed-data` request to the server's active `/cloud/v1/embed-data` route. The generated copy is never committed. The public `/cloud/v1/source` endpoint identifies both the pinned upstream and the corresponding Nyx source.

Run this service only when the operator is authorized to use the upstream game provider and configured provider account. Nyx does not bypass provider access controls or distribute a credential.

## Local verification

```powershell
npm ci --prefix services/stratus
npm run check --prefix services/stratus
```

To start it locally, set a throwaway development key and local public origin in the shell, then run `npm start --prefix services/stratus`. The production key must be generated directly on the VPS and stored only in `/etc/nyx/stratus.env`.

## Production boundaries

- The process listens only on `127.0.0.1:3001` by default.
- Caddy exposes only the embed, embed-data, signaling, health, and source paths.
- Session creation and management remain private loopback calls from the Nyx server.
- The adapter signs into an existing verified provider account. Disposable registration and background account creation are removed. One simultaneous game is allowed for that account.
- Concurrency, duration, and rolling launch limits are bounded by environment configuration.
- `/var/lib/nyx-stratus/runtime` contains the generated API and secret-bearing `sites.json` with restricted permissions.

See `deploy/stratus.env.example` for the supported environment variables.

## Verification failures

A healthy Stratus process does not establish that provider account preparation works. The launcher validates provider email-request and registration responses before proceeding, so rejected requests report a sanitized provider reason instead of always waiting for an email. Repeated verification-code timeouts still require checking the provider/mail delivery; longer retries do not establish a working session.


## Provider account setup

The provider explicitly rejects temporary email addresses (confirmed by a controlled verification request on 2026-09-17; the diagnostic mailbox was deleted). Retrying mailbox creation cannot fix that rejection.

Create and verify a regular provider account using the provider's own supported signup flow. Configure `STRATUS_PROVIDER_EMAIL` and `STRATUS_PROVIDER_PASSWORD` in the protected `/etc/nyx/stratus.env` file (or local process environment). Do not paste credentials into chat or commit them. The existing service units load that file. Restarting production remains a separate deployment action.

The adapter logs into that account using a stable device identifier. It does not create accounts, request email codes, renew trial allowances, or bypass provider limits. The account must have access/credit for the selected game. One account means one simultaneous game; multiple independent users do not imply multiple provider seats. Missing settings return an immediate setup error without starting preparation. A successful authenticated stream still requires testing with a real configured account.
