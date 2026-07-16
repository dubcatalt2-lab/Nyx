# Deploy Nyx to Netlify

The repository is configured to build the Nyx frontend into `dist`, run its HTTP routes as a Netlify Function, and use this Railway Wisp endpoint:

`wss://nyx-temporary-production.up.railway.app/wisp/`

## Deploy from GitHub

1. Commit and push the current project to the GitHub repository you want Netlify to use.
2. In Netlify, choose **Add new project > Import an existing project > GitHub**.
3. Select the GoodLion/Nyx repository.
4. Leave **Base directory** empty. Netlify reads the remaining settings from `netlify.toml`:
   - Build command: `npm run build:netlify`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
5. Choose **Deploy**.

## Allow the new site to use Railway Wisp

After Netlify assigns a URL such as `https://your-site.netlify.app`:

1. Open the Railway Wisp service.
2. Open **Variables**.
3. If `NYX_ALLOWED_ORIGINS` exists, add the exact Netlify origin without a trailing slash. Separate multiple origins with commas.
4. Redeploy the Railway service after saving the variable.

If `NYX_ALLOWED_ORIGINS` is empty or not defined, the Wisp currently accepts every browser origin, so this step is not required but restricting it is safer.

## Optional Nyx AI

In **Netlify > Site configuration > Environment variables**, add `NYX_AI_API_KEY` or `OPENROUTER_API_KEY`. Do not put the key in the repository.

## Test the build locally

```powershell
npm ci
npm run build:netlify
npx netlify-cli build --offline
```

The build intentionally omits five bundled Minecraft HTML files larger than 10 MB because Netlify does not reliably deploy files above that size. Their entries are removed from the generated UGS catalog; the source files are not deleted.
