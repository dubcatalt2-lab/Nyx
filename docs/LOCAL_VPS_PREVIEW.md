# Local preview with VPS services

Run `npm run build:netlify` first, then `node scripts/preview-vps.mjs` from the repository root. Open http://localhost:9091/tutsi. Port 9091 must be free. Press Ctrl+C to stop the preview and SSH tunnel.

This serves the local build and forwards API requests and WebSocket connections through SSH to the existing VPS application. VPS environment variables stay on the VPS. Existing SSH access to `ubuntu@15.204.93.166` is required. No credentials are written to the frontend or downloaded.

Sign in locally to use your account. Actions use production data, quotas and provider services: messages, profile edits and generated content are real. Local server.js changes are not exercised in this mode; the backend is the deployed VPS version. Provider outages affect this preview too.

The preview binds only to loopback and rejects other origins. Do not expose it through a public tunnel. Optional environment variables: `PREVIEW_PORT`, `PREVIEW_TUNNEL_PORT`, `PREVIEW_STATIC_ROOT`, `PREVIEW_SSH_HOST`.
