# Source layout

The repository uses themed source names. Published browser paths remain compatible with existing tabs and static packages through `scripture/source-layout.mjs` and the VPS build.

| Original source | Current source |
| --- | --- |
| assets | relics |
| baremux | communion |
| css | vestments |
| deploy | mission |
| epoxy | incense |
| js | parables |
| scramjet | pilgrim |
| scripts | rituals |
| tools | ministry |
| script.js | gospel.js |
| server.js | shepherd.js |
| startup.js | genesis.js |
| styles.css | vestments.css |
| scramjet.sw.js | pilgrim.sw.js |
| wisp-server.js | fellowship-server.js |
| ai.html | oracle.html |
| app.webmanifest | covenant.webmanifest |
| firestore.rules | covenant.rules |
| nyx-singlefile.html | pilgrimage.html |
| startup-studyhub.html | catechism.html |
| README.md | TESTAMENT.md |
| DEPLOYMENT.md | MISSION.md |
| OWNER_DASHBOARD.md | STEWARDSHIP.md |
| Dockerfile.wisp | Dockerfile.fellowship |
| apps | chapels |
| lib | scripture |
| services | ministries |
| companion | deacon |
| remote-host | hermitage |
| static-export | lectionary |
| docs | scrolls |
| about-nyx.html | testimony.html |
| student-resources.html | teachings.html |
| nyx.html | sanctum.html |
| tutsi-runtime.sw.js | vespers.sw.js |
| server-http-wisp.mjs | fellowship-gateway.mjs |

Remaining first-party filenames use `intercession`, `discernment`, `fellowship`, `incense`, `pilgrim`, and `communion` in place of the previous proxy, search, Wisp, Epoxy, Scramjet, and BareMux terms. The complete mapping is in `scripture/source-layout.mjs`. Third-party branding, required licenses, dependency names and network protocol identifiers are preserved. These source renames do not make downloaded browser code private.

The two old HTML backups are `archive-chronicle.html` and `archive-testament.html`. Ultraviolet and obsolete Netlify deployment files are removed. Tool-discovered names (`package.json`, `package-lock.json`, `firebase.json`, `railway.json`, `.gitignore`, `.gitattributes`, `.dockerignore`, `.nvmrc`) and the default `index.html` entry stay intact.

Use `npm start`, `npm run build:vps`, and `npm run check:deploy`. Deployment scripts are under `mission/`; tests and build helpers are under `rituals/`. Generated `dist/` keeps established public URLs; do not edit it manually. `sourceFile` resolves legacy source references for build/read checks without publishing private code. Both old and new private paths are rejected by the server.
