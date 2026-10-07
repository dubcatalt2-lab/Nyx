import {existsSync} from 'node:fs';
import {dirname,resolve,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export const sourceLayout=Object.freeze({
"index.html":"study.html",
"apps":"chapels",
"lib":"scripture",
"services":"ministries",
"companion":"deacon",
"remote-host":"hermitage",
"static-export":"lectionary",
"docs":"scrolls",
"about-nyx.html":"testimony.html",
"student-resources.html":"teachings.html",
"nyx.html":"sanctum.html",
"tutsi-runtime.sw.js":"vespers.sw.js",
"SOURCE_LAYOUT.md":"CANON.md",
  "app.webmanifest": "covenant.webmanifest",
  "assets": "relics",
  "baremux": "barebooks",
  "css": "vestments",
  "deploy": "mission",
  "epoxy": "incense",
  "js": "parables",
  "scramjet": "pilgrim",
  "scripts": "rituals",
  "tools": "ministry",
  "DEPLOYMENT.md": "MISSION.md",
  "Dockerfile.wisp": "Dockerfile.fellowship",
  "OWNER_DASHBOARD.md": "STEWARDSHIP.md",
  "README.md": "TESTAMENT.md",
  "ai.html": "oracle.html",
  "firestore.rules": "covenant.rules",
  "index.accidental-old-2026-07-10_17-59-36.html": "archive-chronicle.html",
  "index.backup-before-prompt-title.html": "archive-testament.html",
  "nyx-singlefile.html": "pilgrimage.html",
  "scramjet.sw.js": "pilgrim.sw.js",
  "script.js": "gospel.js",
  "server.js": "shepherd.js",
  "startup-studyhub.html": "catechism.html",
  "startup.js": "genesis.js",
  "styles.css": "vestments.css",
  "wisp-server.js": "fellowship-server.js"
});
export const sourceFileLayout=Object.freeze({
  "chapels/tutsi/browser-ad-runtime.mjs": "chapels/tutsi/workspace-ad-runtime.mjs",
  "rituals/build-browser-scramble.mjs": "rituals/build-workspace-scramble.mjs",
  "rituals/test-ad-free-browser.mjs": "rituals/test-ad-free-workspace.mjs",
  "rituals/test-ai-cooldown-browser.mjs": "rituals/test-ai-cooldown-workspace.mjs",
  "rituals/test-ai-history-browser.mjs": "rituals/test-ai-history-workspace.mjs",
  "rituals/test-ai-image-output-browser.mjs": "rituals/test-ai-image-output-workspace.mjs",
  "rituals/test-ai-usage-browser.mjs": "rituals/test-ai-usage-workspace.mjs",
  "rituals/test-ai-web-browser.mjs": "rituals/test-ai-web-workspace.mjs",
  "rituals/test-browser-loading-recovery.mjs": "rituals/test-workspace-loading-recovery.mjs",
  "rituals/test-browser-only.mjs": "rituals/test-workspace-only.mjs",
  "rituals/test-browser-scramble.mjs": "rituals/test-workspace-scramble.mjs",
  "rituals/test-browser-settings-layout.mjs": "rituals/test-workspace-settings-layout.mjs",
  "rituals/test-chat-lock-browser.mjs": "rituals/test-chat-lock-workspace.mjs",
  "rituals/test-chat-social-browser.mjs": "rituals/test-chat-social-workspace.mjs",
  "rituals/test-chat-toast-browser.mjs": "rituals/test-chat-toast-workspace.mjs",
  "rituals/test-chat-voice-browser.mjs": "rituals/test-chat-voice-workspace.mjs",
  "rituals/test-fellowship-browser.mjs": "rituals/test-fellowship-workspace.mjs",
  "rituals/test-http-relay-browser.mjs": "rituals/test-http-relay-workspace.mjs",
  "rituals/test-intercession-build-browser.mjs": "rituals/test-intercession-build-workspace.mjs",
  "rituals/test-intercession-spa-browser.mjs": "rituals/test-intercession-spa-workspace.mjs",
  "rituals/test-nyxcloud-browser.mjs": "rituals/test-nyxcloud-workspace.mjs",
  "rituals/test-nyxcloud-lorem-browser.mjs": "rituals/test-nyxcloud-lorem-workspace.mjs",
  "rituals/test-owner-only-browser.mjs": "rituals/test-owner-only-workspace.mjs",
  "rituals/test-resumable-link-browser.mjs": "rituals/test-resumable-link-workspace.mjs",
  "rituals/test-static-publisher-browser.mjs": "rituals/test-static-publisher-workspace.mjs",
  "rituals/test-tutsi-http-browser.mjs": "rituals/test-tutsi-http-workspace.mjs",
  "chapels/movies/proxy.mjs": "chapels/movies/intercession.mjs",
  "chapels/tutsi/proxy-compat.mjs": "chapels/tutsi/intercession-compat.mjs",
  "chapels/tutsi/proxy.mjs": "chapels/tutsi/intercession.mjs",
  "incense/epoxy.wasm": "incense/incense.wasm",
  "scripture/game-proxy-stream.mjs": "scripture/game-intercession-stream.mjs",
  "scripture/wispurr-relay.mjs": "scripture/fellowship-relay.mjs",
  "mission/haproxy-turn.cfg.template": "mission/sanctuary-turn.cfg.template",
  "parables/ai-model-search.js": "parables/ai-model-discernment.js",
  "parables/proxy-startup.mjs": "parables/intercession-startup.mjs",
  "pilgrim/scramjet.all.js": "pilgrim/pilgrim.all.js",
  "pilgrim/scramjet.sync.js": "pilgrim/pilgrim.sync.js",
  "pilgrim/scramjet.wasm.wasm": "pilgrim/pilgrim.wasm.wasm",
  "relics/transports/epoxy-scramjet.mjs": "relics/transports/incense-pilgrim.mjs",
  "relics/transports/libcurl-baremux.mjs": "relics/transports/libcurl-communion.mjs",
  "relics/transports/libcurl-scramjet.mjs": "relics/transports/libcurl-pilgrim.mjs",
  "rituals/build-proxy-assets.mjs": "rituals/build-intercession-assets.mjs",
  "rituals/proxy-asset-names.json": "rituals/intercession-asset-names.json",
  "rituals/test-ai-capability-search.mjs": "rituals/test-ai-capability-discernment.mjs",
  "rituals/test-chat-member-search.mjs": "rituals/test-chat-member-discernment.mjs",
  "rituals/test-game-proxy-routes.mjs": "rituals/test-game-intercession-routes.mjs",
  "rituals/test-game-proxy-stream.mjs": "rituals/test-game-intercession-stream.mjs",
  "rituals/test-movie-search-types.mjs": "rituals/test-movie-discernment-types.mjs",
  "rituals/test-nyxify-audio-search.mjs": "rituals/test-nyxify-audio-discernment.mjs",
  "rituals/test-nyxify-search-recovery.mjs": "rituals/test-nyxify-discernment-recovery.mjs",
  "rituals/test-proxy-activation.mjs": "rituals/test-intercession-activation.mjs",
  "rituals/test-proxy-build-browser.mjs": "rituals/test-intercession-build-workspace.mjs",
  "rituals/test-proxy-build.mjs": "rituals/test-intercession-build.mjs",
  "rituals/test-proxy-channel-navigation.mjs": "rituals/test-intercession-channel-navigation.mjs",
  "rituals/test-proxy-consent-policy.mjs": "rituals/test-intercession-consent-policy.mjs",
  "rituals/test-proxy-dom-budget.mjs": "rituals/test-intercession-dom-budget.mjs",
  "rituals/test-proxy-engine-policy.mjs": "rituals/test-intercession-engine-policy.mjs",
  "rituals/test-proxy-presentation-recovery.mjs": "rituals/test-intercession-presentation-recovery.mjs",
  "rituals/test-proxy-scope-repair.mjs": "rituals/test-intercession-scope-repair.mjs",
  "rituals/test-proxy-spa-browser.mjs": "rituals/test-intercession-spa-workspace.mjs",
  "rituals/test-proxy-spa-recovery.mjs": "rituals/test-intercession-spa-recovery.mjs",
  "rituals/test-proxy-startup.mjs": "rituals/test-intercession-startup.mjs",
  "rituals/test-proxy-transport-init.mjs": "rituals/test-intercession-transport-init.mjs",
  "rituals/test-proxy-worker-recovery.mjs": "rituals/test-intercession-worker-recovery.mjs",
  "rituals/test-search-transition.mjs": "rituals/test-discernment-transition.mjs",
  "rituals/test-tutsi-first-search.mjs": "rituals/test-tutsi-first-discernment.mjs",
  "rituals/test-tutsi-image-search.mjs": "rituals/test-tutsi-image-discernment.mjs",
  "rituals/test-wisp-origins.mjs": "rituals/test-fellowship-origins.mjs",
  "rituals/test-wispurr-browser.mjs": "rituals/test-fellowship-workspace.mjs",
  "rituals/test-wispurr-relay.mjs": "rituals/test-fellowship-relay.mjs",
  "scramjet-v1.sw.js": "pilgrim-v1.sw.js",
  "server-http-wisp.mjs": "fellowship-gateway.mjs",
"server-http-fellowship.mjs": "fellowship-gateway.mjs"
});
export function sourceFile(value){
 if(typeof value!=='string'&&!(value instanceof URL))return value;
 if(value instanceof URL&&value.protocol!=='file:')return value;
 const absolute=resolve(value instanceof URL?fileURLToPath(value):value);
 const rel=relative(root,absolute);
 if(rel.startsWith('..')||rel.startsWith(sep))return value;
 const [head,...tail]=rel.split(sep);
 const mapped=[sourceLayout[head]||head,...tail].join('/');
 const target=resolve(root,sourceFileLayout[mapped]||mapped);
 return existsSync(target)?target:value;
}
export function publicSourcePath(value){
 const normalized=value.replaceAll('\\','/');
 const file=Object.entries(sourceFileLayout).find(([,renamed])=>renamed===normalized)?.[0]||normalized;
 const [head,...tail]=file.split('/');
 const original=Object.entries(sourceLayout).find(([,renamed])=>renamed===head)?.[0]||head;
 return [original,...tail].join('/');
}
export function publicSourceText(value){
 for(const[from,to]of Object.entries(sourceFileLayout)){
  value=value.split(to.split('/').at(-1)).join(from.split('/').at(-1));
 }
 for(const[from,to]of Object.entries(sourceLayout)){
  for(const quote of ['"',"'",'\x60']){
   for(const prefix of ['/','./','../','../../','../../../','']){
    value=value.split(quote+prefix+to+'/').join(quote+prefix+from+'/');
    value=value.split(quote+prefix+to+quote).join(quote+prefix+from+quote);
   }
  }
 }
 return value;
}
