# Deploy Nyx with Railway Wisp and Render

This repository is configured as two services:

- Railway runs the dedicated Wisp WebSocket server with `npm run start:wisp`.
- Render runs the Nyx Express app with `npm start`.

## Before deploying

Run:

```powershell
npm ci
npm run check:deploy
git status --short
```

Commit every required Nyx file shown by `git status`, especially `script.js`, `startup.js`, `styles.css`, `css/`, `js/loading-screen.js`, and `assets/ugs/play.html`. Hosting providers only receive files committed and pushed to GitHub.

Do not commit `.env` files, API keys, or the large ignored movie files.

## 1. Deploy Wisp on Railway

1. Push this project to GitHub.
2. In Railway, create a project from that GitHub repository.
3. Railway reads `railway.json`, builds `Dockerfile.wisp`, and starts the dedicated Wisp server. The small Docker build excludes Nyx's frontend, games, and development dependencies.
4. In Railway networking, generate a public domain.
5. Confirm `https://YOUR-WISP-DOMAIN/healthz` returns JSON containing `"ok":true`.
6. Your Wisp URL is `wss://YOUR-WISP-DOMAIN/wisp/`.

The server initially allows all browser origins if `NYX_ALLOWED_ORIGINS` is empty. After Render gives Nyx its URL, set this Railway variable immediately:

```text
NYX_ALLOWED_ORIGINS=https://YOUR-NYX-NAME.onrender.com
```

For more than one exact origin, separate them with commas. Add your future custom-domain origin to this list before switching domains.

## 2. Deploy Nyx on Render

1. In Render, choose **New > Blueprint** and select the same GitHub repository.
2. Render reads `render.yaml` and creates the `nyx-temporary` free web service.
3. When prompted for `WISP_URL`, enter Railway's public endpoint:

```text
wss://YOUR-WISP-DOMAIN/wisp/
```

An `https://` Railway URL also works; Nyx converts it to `wss://` and adds `/wisp/` when needed.

4. Deploy and open `https://YOUR-NYX-NAME.onrender.com/healthz`.
5. The response should contain `"wisp":"external"`.
6. Return to Railway and set `NYX_ALLOWED_ORIGINS` to the exact Render origin.

Render's free service can sleep while idle, so the first request after inactivity can be slow. It is suitable as a temporary host, not a permanent production plan.

## Future custom domain

When you buy a domain:

1. Add it to Render's Nyx web service.
2. Add its exact `https://` origin to Railway's `NYX_ALLOWED_ORIGINS`.
3. Keep `WISP_URL` pointing to Railway unless you also move Wisp.

No source-code change is required for the domain switch.
