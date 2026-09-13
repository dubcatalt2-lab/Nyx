# Nyx Stratus service

This directory runs the optional Cloud Gaming backend as a separate, loopback-only process. It is not bundled into browser code and no API key belongs in Git.

## Source and license

`upstream/` is an unmodified snapshot of [`x8rr/stratus-api`](https://github.com/x8rr/stratus-api) at commit `bd760513ce7616e955181dfd18017e2a6c278e3c`. The upstream project is licensed under AGPL-3.0; its license is preserved in `UPSTREAM-LICENSE`.

`launcher.mjs` verifies the pinned files, writes a generated runtime copy, and applies Nyx's deployment hardening there. It also updates the pinned embed client's obsolete `/api/cloud/embed-data` request to the server's active `/cloud/v1/embed-data` route. The generated copy is never committed. The public `/cloud/v1/source` endpoint identifies both the pinned upstream and the corresponding Nyx source.

Run this service only when the operator is authorized to use the upstream game provider and disposable-account flow. Nyx does not bypass provider access controls or distribute a credential.

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
- The idle account pool defaults to one so launches normally use a prepared provider account instead of waiting through account provisioning.
- Concurrency, duration, and rolling launch limits are bounded by environment configuration.
- `/var/lib/nyx-stratus/runtime` contains the generated API and secret-bearing `sites.json` with restricted permissions.

See `deploy/stratus.env.example` for the supported environment variables.
