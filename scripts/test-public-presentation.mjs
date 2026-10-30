import assert from 'node:assert/strict';
import {neutralPublicCopy} from './build-public-copy.mjs';
import {rewriteLegacyPublicPath} from '../lib/public-paths.mjs';
const source='<!doctype html><title>Unblocked Games - Play Now</title><meta name="description" content="Free games and a web proxy"><h1>Scramjet v2</h1><p>Bypass with this proxy</p><a href="https://provider.test/games/play/">Play now</a><input value="unblocked"><script>const proxy="unblocked";const coach_credit=999;</script><pre>proxy code</pre><footer>Copyright Scramjet - required license</footer>';
const result=neutralPublicCopy(source,'fixture.html');
assert.match(result,/<title>Tutoring [0-9a-f]{6}<\/title>/);
assert(result.includes('Study activities and a connection'));
assert(result.includes('https://provider.test/games/play/'));
assert(result.includes('<input value="unblocked">'));
assert(result.includes('<script>const proxy="unblocked";const coach_credit=999;</script>'));
assert(result.includes('<pre>proxy code</pre>'));
assert(result.includes('Copyright Scramjet - required license'));
assert.equal(neutralPublicCopy(result,'fixture.html'),result);
for(const [old,current] of [['/api/cloud-gaming/sessions?q=/games/','/api/cloud-studies/sessions?q=/games/'],['/gms-games-proxy?url=https://provider.test/game/','/math-proxy?url=https://provider.test/game/'],['/assets/gms-games/play.html','/assets/math/play.html'],['/api/games/reports','/api/studies/reports']])assert.equal(rewriteLegacyPublicPath(old),current);
assert.equal(rewriteLegacyPublicPath('/other/api/cloud-gaming/x'),'/other/api/cloud-gaming/x');
assert.equal(rewriteLegacyPublicPath('/api/cloud-gaming-other/x'),'/api/cloud-gaming-other/x');
console.log('PASS neutral titles/prose, idempotent build, unchanged external URLs/scripts/inputs/licenses, and exact legacy path compatibility');

const {createDomHookTransform,domHookAlias}=await import('./build-dom-hooks.mjs');const hooks=createDomHookTransform();const runtime='const provider=document.currentScript.dataset.provider;';hooks.collect(runtime,'assets/studies/study-health.js');const local=hooks.rewrite('<script src="/health.js" data-provider="gn"></script>','assets/reading/play.html');assert(local.includes('data-'+domHookAlias('attribute','data-provider')));assert(hooks.rewrite('<script src="https://sdk.test/client.js" data-provider="external"></script>','app.html').includes('data-provider="external"'));console.log('PASS linked local script attributes and unchanged external SDK attributes');

assert.equal(rewriteLegacyPublicPath('/assets/gms-games/games.json?rev=1'),'/assets/math/studies.json?rev=1');
