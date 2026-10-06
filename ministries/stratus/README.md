# Nyx Stratus service

This directory runs the optional Cloud Gaming backend as a separate, loopback-only process. It is not bundled into browser code and no API key belongs in Git.

## Source and license

`upstream/` is an unmodified snapshot of [`x8rr/stratus-api`](https://github.com/x8rr/stratus-api) at commit `bd760513ce7616e955181dfd18017e2a6c278e3c`. The upstream project is licensed under AGPL-3.0; its license is preserved in `UPSTREAM-LICENSE`.

`launcher.mjs` verifies the pinned files, writes a generated runtime copy, and applies Nyx's deployment hardening there. It also updates the pinned embed client's obsolete `/api/cloud/embed-data` request to the server's active `/cloud/v1/embed-data` route. The generated copy is never committed. The public `/cloud/v1/source` endpoint identifies both the pinned upstream and the corresponding Nyx source.

Run this service only when the operator is authorized to use the upstream game provider and configured provider account. Nyx does not bypass provider access controls or distribute a credential.

## Local verification

```powershell
npm ci --prefix ministries/stratus
npm run check --prefix ministries/stratus
```

To start it locally, set a throwaway development key and local public origin in the shell, then run `npm start --prefix ministries/stratus`. The production key must be generated directly on the VPS and stored only in `/etc/nyx/stratus.env`.

## Production boundaries

- The process listens only on `127.0.0.1:3001` by default.
- Caddy exposes only the embed, embed-data, signaling, health, and source paths.
- Session creation and management remain private loopback calls from the Nyx server.
- The adapter signs into an existing verified provider account. Disposable registration and background account creation are removed. One simultaneous game is allowed for that account.
- Concurrency, duration, and rolling launch limits are bounded by environment configuration.
- `/var/lib/nyx-stratus/runtime` contains the generated API and secret-bearing `sites.json` with restricted permissions.

See `deploy/stratus.env.example` for the supported environment variables.

## Provider access failures

A healthy Stratus process and successful provider login do not establish permission to stream a game. The generated runtime checks `/userGame/checkCost` before calling `/jyapi/playGame`. The provider can return HTTP 200 with a non-success status in its JSON; status `3004` means the account lacks streaming credit. That rejection now stops game allocation immediately and reports a clear setup error without exposing account data. Failed sign-in or game initialization does not consume the adapter's launch allowance.

Stratus provides the integration, not provider credit. Use the provider's supported account/billing flow to restore access, then verify a real game stream before disabling Nyx's Cloud Gaming maintenance setting. No automatic recharge, registration, or trial renewal is performed.


## Provider account setup

The provider explicitly rejects temporary email addresses (confirmed by a controlled verification request on 2026-09-17; the diagnostic mailbox was deleted). Retrying mailbox creation cannot fix that rejection.

Create and verify a regular provider account using the provider's own supported signup flow. Configure `STRATUS_PROVIDER_EMAIL` and `STRATUS_PROVIDER_PASSWORD` in the protected `/etc/nyx/stratus.env` file (or local process environment). Do not paste credentials into chat or commit them. The existing service units load that file. Restarting production remains a separate deployment action.

The adapter logs into that account using a stable device identifier. It does not create accounts, request email codes, renew trial allowances, or bypass provider limits. The account must have access/credit for the selected game. One account means one simultaneous game; multiple independent users do not imply multiple provider seats. Missing settings return an immediate setup error without starting preparation. A successful authenticated stream still requires testing with a real configured account.
