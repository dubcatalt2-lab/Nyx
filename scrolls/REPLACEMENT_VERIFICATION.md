> Historical verification snapshot. For the latest search repairs, interaction sweep and current release failures, see [SEARCH_AND_UI_VERIFICATION.md](SEARCH_AND_UI_VERIFICATION.md). The older counts below are retained as historical evidence.

# COMPLETED

- Removed all six requested direct dependencies. Deleted the root lockfile, regenerated it, then completed a fresh npm ci. The original connection application is now an npm workspace.
- Deleted copied runtime directories, both old worker entry files, the previous relay implementation, and generators that copied or renamed the removed engine. Deleted CANON.md. These deletions are not replacement copies under different names.
- Connected Nyx document launch to the original connection service on a separate origin. The relay entry is relay.js and its npm script is start:relay. Local account application runs on 8080; document service on 8082.
- Original transport and HTML/CSS/JavaScript transforms pass unit and browser fixtures. Actual Nyx launch into the separate service and public HTTPS rendering were checked.
- Desktop/mobile source and built navigation, cached redirect recovery, saved-game persistence, selected AI quota/access tests, and built catalog/player controls pass their targeted checks.

# INCOMPLETE

- Full release build fails. Raw scan has 962 matching lines; decoded/source-aware audit reports 1641 signature matches, 12 path matches, and 24 parse failures. Remaining first-party settings/state/old URL recognition and bundled game content must still be corrected. Literal scanner definitions and this required evidence report also retain names; a repository-wide zero-occurrence claim would be false.
- Native call limits fail: 93 atob, 164 eval, 74 native Function sites. Parse failures mean the inventory is not complete. Replacing eval mechanically can change lexical scope and break game code; this is not claimed fixed.
- Separate account-origin isolation is tested; isolation between unrelated remote sites inside the document service is not complete. Authenticated live sockets, arbitrary-site navigation/script compatibility, custom media inspection, ad-policy propagation and full static-export integration remain incomplete.
- Full all-functions validation has not passed. Earlier aggregate tests had unresolved media/account/model/static-export failures; current targeted checks are not an aggregate pass.
- Fresh installation reported 21 dependency vulnerabilities (1 low, 12 moderate, 7 high, 1 critical). No forced dependency upgrade was applied.
- No complete comparable pre-change bundle measurement was retained. Current output size is reported below without an invented before/after comparison. Docker release configuration and remote CI/branch protection have not been verified.
- This replacement is local and uncommitted. It has not been pushed or deployed. The separately released redirect repair is public commit 724288e5dbed4e48951d36209c6edfb707d83859 and VPS source ae20381381eda600019cac4271830f93f8de3d08; those releases still use their previous engine.

# VERIFICATION OUTPUT

Dependency removal:

```text
PASS manifest: no prohibited dependency
PASS regenerated lockfile: 408 entries, no prohibited package or dependency
PASS installed tree: 348 packages, no prohibited package
PASS copied runtimes, workers, relay and asset-copy generator are absent
PASS start:relay uses the original implementation
```
Full release AST/decoded scan (exit 1):

```text
{
  "passed": false,
  "files": 3548,
  "counts": {
    "atob": 93,
    "eval": 164,
    "Function": 74
  },
  "nonGlobalFunctionMethods": 2,
  "signatureMatches": 1641,
  "pathMatches": 12,
  "parseErrors": 24,
  "unreadable": 0,
  "sourceMaps": 0,
  "report": ".codex-artifacts/full-release-audit.json"
}
```
Original component scan:

```text
{
  "passed": true,
  "files": 5,
  "counts": {
    "atob": 0,
    "eval": 0,
    "Function": 0
  },
  "nonGlobalFunctionMethods": 6,
  "signatureMatches": 0,
  "pathMatches": 0,
  "parseErrors": 0,
  "unreadable": 0,
  "sourceMaps": 0,
  "report": null
}
```
Raw static scrub (rg exit 0 means matches were found; therefore FAIL). All output follows, not a sample:

```text
dist\@r525f31eeb43c82e14a860e31!.js:1:scramjet
dist\@r525f31eeb43c82e14a860e31!.js:1:epoxy
dist\@r525f31eeb43c82e14a860e31!.js:1:wisp
dist\@r525f31eeb43c82e14a860e31!.js:1:libcurl
dist\@r525f31eeb43c82e14a860e31!.js:1:libcurl
dist\@r525f31eeb43c82e14a860e31!.js:1:scramjet
dist\@r525f31eeb43c82e14a860e31!.js:1:scramjet
dist\@r525f31eeb43c82e14a860e31!.js:1:scramjet
dist\@r525f31eeb43c82e14a860e31!.js:1:Scramjet
dist\@r525f31eeb43c82e14a860e31!.js:1:scramjet
dist\@r525f31eeb43c82e14a860e31!.js:1:wisp
dist\@r525f31eeb43c82e14a860e31!.js:1:wisp
dist\@r525f31eeb43c82e14a860e31!.js:1:wisp
dist\@r525f31eeb43c82e14a860e31!.js:1:wisp
dist\@r525f31eeb43c82e14a860e31!.js:1:wisp
dist\@r525f31eeb43c82e14a860e31!.js:1:wisp
dist\@r525f31eeb43c82e14a860e31!.js:1:wisp
dist\@r525f31eeb43c82e14a860e31!.js:1:wisp
dist\styles.css:4888:fern
dist\styles.css:4894:fern
dist\styles.css:4906:fern
dist\styles.css:4907:fern
dist\styles.css:4911:fern
dist\styles.css:4912:fern
dist\styles.css:4921:fern
dist\styles.css:4922:fern
dist\styles.css:4953:wisp
dist\styles.css:5081:fern
dist\styles.css:5088:fern
dist\styles.css:5091:fern
dist\styles.css:5093:fern
dist\styles.css:5101:fern
dist\styles.css:5274:wisp
dist\styles.css:5373:fern
dist\styles.css:5476:fern
dist\styles.css:5479:fern
dist\styles.css:5485:fern
dist\styles.css:5488:fern
dist\styles.css:5489:fern
dist\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:scramjet
dist\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:epoxy
dist\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:wisp
dist\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:libcurl
dist\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:libcurl
dist\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:scramjet
dist\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:scramjet
dist\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:scramjet
dist\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:Scramjet
dist\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:scramjet
dist\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:wisp
dist\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:wisp
dist\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:wisp
dist\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:wisp
dist\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:wisp
dist\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:wisp
dist\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:wisp
dist\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:wisp
dist\css\avatar-decorations.css:77:fern
dist\css\avatar-decorations.css:78:fern
dist\css\avatar-decorations.css:79:fern
dist\css\avatar-decorations.css:111:fern
dist\css\avatar-decorations.css:169:fern
dist\css\avatar-decorations.css:170:fern
dist\css\avatar-decorations.css:171:fern
dist\css\avatar-decorations.css:227:fern
dist\css\avatar-decorations.css:255:fern
dist\script.js:1:scramjet
dist\script.js:1:epoxy
dist\script.js:1:wisp
dist\script.js:1:libcurl
dist\script.js:1:libcurl
dist\script.js:1:scramjet
dist\script.js:1:scramjet
dist\script.js:1:scramjet
dist\script.js:1:Scramjet
dist\script.js:1:scramjet
dist\script.js:1:wisp
dist\script.js:1:wisp
dist\script.js:1:wisp
dist\script.js:1:wisp
dist\script.js:1:wisp
dist\script.js:1:wisp
dist\script.js:1:wisp
dist\script.js:1:wisp
dist\robots.txt:34:scramjet
dist\robots.txt:35:wisp
dist\css\theme-tints.css:140:fern
dist\css\theme-tints.css:141:fern
dist\css\theme-tints.css:142:fern
dist\css\theme-tints.css:143:fern
dist\css\theme-tints.css:144:fern
dist\css\theme-tints.css:145:fern
dist\css\theme-tints.css:146:fern
dist\css\theme-tints.css:147:fern
dist\css\theme-tints.css:148:fern
dist\css\theme-tints.css:151:fern
dist\css\theme-tints.css:152:fern
dist\css\theme-tints.css:153:fern
dist\css\theme-tints.css:159:fern
dist\css\theme-tints.css:160:fern
dist\css\theme-tints.css:161:fern
dist\css\theme-tints.css:162:fern
dist\css\theme-tints.css:164:fern
dist\css\theme-tints.css:165:fern
dist\css\theme-tints.css:166:fern
dist\css\theme-tints.css:167:fern
dist\css\theme-tints.css:170:fern
dist\css\theme-tints.css:171:fern
dist\css\theme-tints.css:172:fern
dist\css\theme-tints.css:174:fern
dist\css\theme-tints.css:175:fern
dist\css\theme-tints.css:176:fern
dist\css\theme-tints.css:178:fern
dist\css\theme-tints.css:179:fern
dist\css\theme-tints.css:184:fern
dist\css\theme-tints.css:185:fern
dist\css\theme-tints.css:186:fern
dist\css\theme-tints.css:188:fern
dist\css\theme-tints.css:192:fern
dist\apps\cloud-gaming\luna-connection.js:1:libcurl
dist\apps\cloud-gaming\@rd2fbf7bdcd83045dfad64214!.js:1:libcurl
dist\apps\cloud-gaming\@00f3b657\528f2819\@r217a8244cc6bf3d653e3e1bf!.js:1:libcurl
dist\apps\tutsi\@ee01656c\9f0e9a51\@radf111099864764a52731203!.js:1:Scramjet
dist\apps\tutsi\frame-navigation.js:1:Scramjet
dist\apps\nyxify\app.js:1:fern
dist\apps\nyxify\app.js:1:fern
dist\apps\nyxify\app.js:1:fern
dist\apps\nyxify\app.js:1:fern
dist\apps\nyxify\@rb8127075b201efe74bb51d68!.js:1:fern
dist\apps\nyxify\@rb8127075b201efe74bb51d68!.js:1:fern
dist\apps\nyxify\@rb8127075b201efe74bb51d68!.js:1:fern
dist\apps\nyxify\@rb8127075b201efe74bb51d68!.js:1:fern
dist\apps\nyxify\@f0c6c284\2d505971\@r3d7481fbbe9a1ac8ff709cab!.js:1:fern
dist\apps\nyxify\@f0c6c284\2d505971\@r3d7481fbbe9a1ac8ff709cab!.js:1:fern
dist\apps\nyxify\@f0c6c284\2d505971\@r3d7481fbbe9a1ac8ff709cab!.js:1:fern
dist\apps\nyxify\@f0c6c284\2d505971\@r3d7481fbbe9a1ac8ff709cab!.js:1:fern
dist\apps\movies\proxy.js:1:libcurl
dist\apps\tutsi\@rbb67d7dcaa90043b6c3b5e1b!.js:1:Scramjet
dist\apps\movies\@re874b847568a139e69119ffa!.js:1:libcurl
dist\assets\vendor\balatro\love.wasm:22540:ferN
dist\assets\vendor\balatro\love.wasm:22540:ferN
dist\assets\vendor\balatro\love.wasm:22540:ferN
dist\assets\vendor\balatro\love.wasm:22540:ferN
dist\assets\vendor\balatro\love.wasm:22540:ferN
dist\assets\vendor\balatro\love.wasm:22540:ferN
dist\apps\movies\@e059353c\5562033b\@ra46e58cbaa00cfd0428dd341!.js:1:libcurl
dist\assets\profile\effects\catalog.json:527:Wisp
dist\apps\jsdelivr-publisher\static-package\files\styles.css:4888:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:4894:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:4906:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:4907:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:4911:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:4912:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:4921:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:4922:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:4953:wisp
dist\apps\jsdelivr-publisher\static-package\files\styles.css:5081:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:5088:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:5091:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:5093:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:5101:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:5274:wisp
dist\apps\jsdelivr-publisher\static-package\files\styles.css:5373:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:5476:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:5479:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:5485:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:5488:fern
dist\apps\jsdelivr-publisher\static-package\files\styles.css:5489:fern
dist\apps\jsdelivr-publisher\static-package\files\script.js:1:scramjet
dist\apps\jsdelivr-publisher\static-package\files\script.js:1:epoxy
dist\apps\jsdelivr-publisher\static-package\files\script.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\script.js:1:libcurl
dist\apps\jsdelivr-publisher\static-package\files\script.js:1:libcurl
dist\apps\jsdelivr-publisher\static-package\files\script.js:1:scramjet
dist\apps\jsdelivr-publisher\static-package\files\script.js:1:scramjet
dist\apps\jsdelivr-publisher\static-package\files\script.js:1:scramjet
dist\apps\jsdelivr-publisher\static-package\files\script.js:1:Scramjet
dist\apps\jsdelivr-publisher\static-package\files\script.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\script.js:1:scramjet
dist\apps\jsdelivr-publisher\static-package\files\script.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\script.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\script.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\script.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\script.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\robots.txt:34:scramjet
dist\apps\jsdelivr-publisher\static-package\files\robots.txt:35:wisp
dist\apps\jsdelivr-publisher\static-package\files\README.txt:7:Scramjet
dist\apps\jsdelivr-publisher\static-package\files\README.txt:11:Wisp
dist\apps\jsdelivr-publisher\static-package\files\README.txt:14:Scramjet
dist\assets\vendor\hls.min.js:3:ferN
dist\assets\vendor\hls.min.js:3:ferN
dist\assets\vendor\hls.min.js:3:ferN
dist\assets\vendor\hls.min.js:3:ferN
dist\assets\vendor\hls.min.js:3:ferN
dist\assets\vendor\hls.min.js:3:ferN
dist\assets\vendor\hls.min.js:3:ferN
dist\assets\vendor\hls.min.js:3:ferN
dist\assets\vendor\hls.min.js:3:ferN
dist\assets\vendor\hls.min.js:3:ferN
dist\assets\vendor\hls.min.js:3:ferN
dist\assets\vendor\hls.min.js:3:ferN
dist\assets\vendor\hls.min.js:3:ferN
dist\apps\jsdelivr-publisher\static-package\files\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:scramjet
dist\apps\jsdelivr-publisher\static-package\files\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:epoxy
dist\apps\jsdelivr-publisher\static-package\files\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:libcurl
dist\apps\jsdelivr-publisher\static-package\files\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:libcurl
dist\apps\jsdelivr-publisher\static-package\files\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:scramjet
dist\apps\jsdelivr-publisher\static-package\files\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:scramjet
dist\apps\jsdelivr-publisher\static-package\files\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:scramjet
dist\apps\jsdelivr-publisher\static-package\files\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:Scramjet
dist\apps\jsdelivr-publisher\static-package\files\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:scramjet
dist\apps\jsdelivr-publisher\static-package\files\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\@28b23060\e60f9b50\@r916d1a4bd4a3a776f746a5a7!.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:140:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:141:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:142:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:143:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:144:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:145:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:146:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:147:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:148:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:151:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:152:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:153:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:159:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:160:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:161:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:162:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:164:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:165:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:166:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:167:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:170:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:171:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:172:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:174:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:175:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:176:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:178:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:179:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:184:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:185:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:186:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:188:fern
dist\apps\jsdelivr-publisher\static-package\files\css\theme-tints.css:192:fern
dist\apps\jsdelivr-publisher\static-package\files\css\avatar-decorations.css:77:fern
dist\apps\jsdelivr-publisher\static-package\files\css\avatar-decorations.css:78:fern
dist\apps\jsdelivr-publisher\static-package\files\css\avatar-decorations.css:79:fern
dist\apps\jsdelivr-publisher\static-package\files\css\avatar-decorations.css:111:fern
dist\apps\jsdelivr-publisher\static-package\files\css\avatar-decorations.css:169:fern
dist\apps\jsdelivr-publisher\static-package\files\css\avatar-decorations.css:170:fern
dist\apps\jsdelivr-publisher\static-package\files\css\avatar-decorations.css:171:fern
dist\apps\jsdelivr-publisher\static-package\files\css\avatar-decorations.css:227:fern
dist\apps\jsdelivr-publisher\static-package\files\css\avatar-decorations.css:255:fern
dist\assets\profile\effects\fx-astral-spark.png:2720:FeRN
dist\assets\ugs\J\cljellytruck.html:47:ProxyUrl
dist\assets\ugs\J\cljellytruck.html:47:proxyUrl
dist\assets\ugs\J\cljellytruck.html:481:proxyUrl
dist\assets\ugs\J\cljellytruck.html:482:proxyUrl
dist\assets\ugs\J\cljellytruck.html:482:proxyUrl
dist\assets\ugs\J\cljellytruck.html:482:proxyUrl
dist\assets\ugs\J\cljellytruck.html:483:proxyUrl
dist\assets\ugs\J\cljellytruck.html:524:proxyUrl
dist\assets\ugs\J\cljellytruck.html:524:ProxyUrl
dist\assets\ugs\J\cljellytruck.html:526:proxyUrl
dist\assets\ugs\J\cljellytruck.html:527:proxyUrl
dist\assets\ugs\J\cljellytruck.html:540:ProxyUrl
dist\assets\ugs\J\cljellytruck.html:545:proxyUrl
dist\assets\ugs\J\cljellytruck.html:554:ProxyUrl
dist\assets\ugs\J\cljellytruck.html:678:ProxyUrl
dist\assets\ugs\J\cljellytruck.html:771:ProxyUrl
dist\assets\ugs\J\cljellytruck.html:771:proxyUrl
dist\assets\ugs\G\clgunmayhem2.html:48:ProxyUrl
dist\assets\ugs\G\clgunmayhem2.html:48:proxyUrl
dist\assets\ugs\G\clgunmayhem2.html:482:proxyUrl
dist\assets\ugs\G\clgunmayhem2.html:483:proxyUrl
dist\assets\ugs\G\clgunmayhem2.html:483:proxyUrl
dist\assets\ugs\G\clgunmayhem2.html:483:proxyUrl
dist\assets\ugs\G\clgunmayhem2.html:484:proxyUrl
dist\assets\ugs\G\clgunmayhem2.html:525:proxyUrl
dist\assets\ugs\G\clgunmayhem2.html:525:ProxyUrl
dist\assets\ugs\G\clgunmayhem2.html:527:proxyUrl
dist\assets\ugs\G\clgunmayhem2.html:528:proxyUrl
dist\assets\ugs\G\clgunmayhem2.html:541:ProxyUrl
dist\assets\ugs\G\clgunmayhem2.html:546:proxyUrl
dist\assets\ugs\G\clgunmayhem2.html:555:ProxyUrl
dist\assets\ugs\G\clgunmayhem2.html:679:ProxyUrl
dist\assets\ugs\G\clgunmayhem2.html:772:ProxyUrl
dist\assets\ugs\G\clgunmayhem2.html:772:proxyUrl
dist\assets\ugs\G\clgeometrydashscratch.html:204:WISp
dist\assets\ugs\G\clgeometrydashscratch.html:341:WIsp
dist\assets\ugs\G\clgeometrydashscratch.html:368:ScRAM
dist\assets\ugs\G\clgeometrydashscratch.html:371:wISP
dist\apps\jsdelivr-publisher\static-package\files\apps\nyxify\app.js:1:fern
dist\apps\jsdelivr-publisher\static-package\files\apps\nyxify\app.js:1:fern
dist\apps\jsdelivr-publisher\static-package\files\apps\nyxify\app.js:1:fern
dist\apps\jsdelivr-publisher\static-package\files\apps\nyxify\app.js:1:fern
dist\apps\jsdelivr-publisher\static-package\files\apps\nyxify\@rb8127075b201efe74bb51d68!.js:1:fern
dist\apps\jsdelivr-publisher\static-package\files\apps\nyxify\@rb8127075b201efe74bb51d68!.js:1:fern
dist\apps\jsdelivr-publisher\static-package\files\apps\nyxify\@rb8127075b201efe74bb51d68!.js:1:fern
dist\apps\jsdelivr-publisher\static-package\files\apps\nyxify\@rb8127075b201efe74bb51d68!.js:1:fern
dist\apps\jsdelivr-publisher\static-package\files\apps\nyxify\@f0c6c284\2d505971\@r3d7481fbbe9a1ac8ff709cab!.js:1:fern
dist\apps\jsdelivr-publisher\static-package\files\apps\nyxify\@f0c6c284\2d505971\@r3d7481fbbe9a1ac8ff709cab!.js:1:fern
dist\apps\jsdelivr-publisher\static-package\files\apps\nyxify\@f0c6c284\2d505971\@r3d7481fbbe9a1ac8ff709cab!.js:1:fern
dist\apps\jsdelivr-publisher\static-package\files\apps\nyxify\@f0c6c284\2d505971\@r3d7481fbbe9a1ac8ff709cab!.js:1:fern
dist\apps\jsdelivr-publisher\static-package\files\apps\movies\proxy.js:1:libcurl
dist\apps\jsdelivr-publisher\static-package\files\apps\movies\@re874b847568a139e69119ffa!.js:1:libcurl
dist\apps\jsdelivr-publisher\static-package\files\apps\movies\@e059353c\5562033b\@ra46e58cbaa00cfd0428dd341!.js:1:libcurl
dist\assets\ugs\T\cltanukisunset.html:48:ProxyUrl
dist\assets\ugs\T\cltanukisunset.html:48:proxyUrl
dist\assets\ugs\T\cltanukisunset.html:482:proxyUrl
dist\assets\ugs\T\cltanukisunset.html:483:proxyUrl
dist\assets\ugs\T\cltanukisunset.html:483:proxyUrl
dist\assets\ugs\T\cltanukisunset.html:483:proxyUrl
dist\assets\ugs\T\cltanukisunset.html:484:proxyUrl
dist\assets\ugs\T\cltanukisunset.html:525:proxyUrl
dist\assets\ugs\T\cltanukisunset.html:525:ProxyUrl
dist\assets\ugs\T\cltanukisunset.html:527:proxyUrl
dist\assets\ugs\T\cltanukisunset.html:528:proxyUrl
dist\assets\ugs\T\cltanukisunset.html:541:ProxyUrl
dist\assets\ugs\T\cltanukisunset.html:546:proxyUrl
dist\assets\ugs\T\cltanukisunset.html:555:ProxyUrl
dist\assets\ugs\T\cltanukisunset.html:679:ProxyUrl
dist\assets\ugs\T\cltanukisunset.html:772:ProxyUrl
dist\assets\ugs\T\cltanukisunset.html:772:proxyUrl
dist\assets\ugs\T\cltankmayhem.html:47:ProxyUrl
dist\assets\ugs\T\cltankmayhem.html:47:proxyUrl
dist\assets\ugs\T\cltankmayhem.html:481:proxyUrl
dist\assets\ugs\T\cltankmayhem.html:482:proxyUrl
dist\assets\ugs\T\cltankmayhem.html:482:proxyUrl
dist\assets\ugs\T\cltankmayhem.html:482:proxyUrl
dist\assets\ugs\T\cltankmayhem.html:483:proxyUrl
dist\assets\ugs\T\cltankmayhem.html:524:proxyUrl
dist\assets\ugs\T\cltankmayhem.html:524:ProxyUrl
dist\assets\ugs\T\cltankmayhem.html:526:proxyUrl
dist\assets\ugs\T\cltankmayhem.html:527:proxyUrl
dist\assets\ugs\T\cltankmayhem.html:540:ProxyUrl
dist\assets\ugs\T\cltankmayhem.html:545:proxyUrl
dist\assets\ugs\T\cltankmayhem.html:554:ProxyUrl
dist\assets\ugs\T\cltankmayhem.html:678:ProxyUrl
dist\assets\ugs\T\cltankmayhem.html:771:ProxyUrl
dist\assets\ugs\T\cltankmayhem.html:771:proxyUrl
dist\assets\ugs\D\cldriftboss.html:55:ProxyUrl
dist\assets\ugs\D\cldriftboss.html:55:proxyUrl
dist\assets\ugs\D\cldriftboss.html:489:proxyUrl
dist\assets\ugs\D\cldriftboss.html:490:proxyUrl
dist\assets\ugs\D\cldriftboss.html:490:proxyUrl
dist\assets\ugs\D\cldriftboss.html:490:proxyUrl
dist\assets\ugs\D\cldriftboss.html:491:proxyUrl
dist\assets\ugs\D\cldriftboss.html:532:proxyUrl
dist\assets\ugs\D\cldriftboss.html:532:ProxyUrl
dist\assets\ugs\D\cldriftboss.html:534:proxyUrl
dist\assets\ugs\D\cldriftboss.html:535:proxyUrl
dist\assets\ugs\D\cldriftboss.html:548:ProxyUrl
dist\assets\ugs\D\cldriftboss.html:553:proxyUrl
dist\assets\ugs\D\cldriftboss.html:562:ProxyUrl
dist\assets\ugs\D\cldriftboss.html:686:ProxyUrl
dist\assets\ugs\D\cldriftboss.html:779:ProxyUrl
dist\assets\ugs\D\cldriftboss.html:779:proxyUrl
dist\apps\jsdelivr-publisher\static-package\files\apps\cloud-gaming\luna-connection.js:1:libcurl
dist\apps\jsdelivr-publisher\static-package\files\apps\cloud-gaming\@rd2fbf7bdcd83045dfad64214!.js:1:libcurl
dist\apps\jsdelivr-publisher\static-package\files\apps\cloud-gaming\@00f3b657\528f2819\@r217a8244cc6bf3d653e3e1bf!.js:1:libcurl
dist\assets\ugs\T\clthereisnofile.html:48:ProxyUrl
dist\assets\ugs\T\clthereisnofile.html:48:proxyUrl
dist\assets\ugs\T\clthereisnofile.html:482:proxyUrl
dist\assets\ugs\T\clthereisnofile.html:483:proxyUrl
dist\assets\ugs\T\clthereisnofile.html:483:proxyUrl
dist\assets\ugs\T\clthereisnofile.html:483:proxyUrl
dist\assets\ugs\T\clthereisnofile.html:484:proxyUrl
dist\assets\ugs\T\clthereisnofile.html:525:proxyUrl
dist\assets\ugs\T\clthereisnofile.html:525:ProxyUrl
dist\assets\ugs\T\clthereisnofile.html:527:proxyUrl
dist\assets\ugs\T\clthereisnofile.html:528:proxyUrl
dist\assets\ugs\T\clthereisnofile.html:541:ProxyUrl
dist\assets\ugs\T\clthereisnofile.html:546:proxyUrl
dist\assets\ugs\T\clthereisnofile.html:555:ProxyUrl
dist\assets\ugs\T\clthereisnofile.html:679:ProxyUrl
dist\assets\ugs\T\clthereisnofile.html:772:ProxyUrl
dist\assets\ugs\T\clthereisnofile.html:772:proxyUrl
dist\assets\ugs\D\cldoodlejumpgoober.html:38:Fern
dist\assets\ugs\D\cldoodlejump.html:31:Fern
dist\assets\profile\decorations\cybernetic-halo.png:2720:FeRN
dist\assets\profile\decorations\catalog.json:24:Wisp
dist\assets\profile\decorations\catalog.json:193:fern
dist\assets\profile\decorations\catalog.json:195:fern
dist\assets\profile\decorations\catalog.json:196:fern
dist\assets\profile\decorations\catalog.json:200:fern
dist\apps\jsdelivr-publisher\static-package\files\@r85e20fde1445866b404c1a1d!.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\@r85e20fde1445866b404c1a1d!.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\@r85e20fde1445866b404c1a1d!.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\@r85e20fde1445866b404c1a1d!.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\@r85e20fde1445866b404c1a1d!.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\@r525f31eeb43c82e14a860e31!.js:1:scramjet
dist\apps\jsdelivr-publisher\static-package\files\@r525f31eeb43c82e14a860e31!.js:1:epoxy
dist\apps\jsdelivr-publisher\static-package\files\@r525f31eeb43c82e14a860e31!.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\@r525f31eeb43c82e14a860e31!.js:1:libcurl
dist\apps\jsdelivr-publisher\static-package\files\@r525f31eeb43c82e14a860e31!.js:1:libcurl
dist\apps\jsdelivr-publisher\static-package\files\@r525f31eeb43c82e14a860e31!.js:1:scramjet
dist\apps\jsdelivr-publisher\static-package\files\@r525f31eeb43c82e14a860e31!.js:1:scramjet
dist\apps\jsdelivr-publisher\static-package\files\@r525f31eeb43c82e14a860e31!.js:1:scramjet
dist\apps\jsdelivr-publisher\static-package\files\@r525f31eeb43c82e14a860e31!.js:1:Scramjet
dist\apps\jsdelivr-publisher\static-package\files\@r525f31eeb43c82e14a860e31!.js:1:scramjet
dist\apps\jsdelivr-publisher\static-package\files\@r525f31eeb43c82e14a860e31!.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\@r525f31eeb43c82e14a860e31!.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\@r525f31eeb43c82e14a860e31!.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\@r525f31eeb43c82e14a860e31!.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\@r525f31eeb43c82e14a860e31!.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\@r525f31eeb43c82e14a860e31!.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\@r525f31eeb43c82e14a860e31!.js:1:wisp
dist\apps\jsdelivr-publisher\static-package\files\@r525f31eeb43c82e14a860e31!.js:1:wisp
dist\assets\ugs\C\clcuttherope.html:74:ProxyUrl
dist\assets\ugs\C\clcuttherope.html:74:proxyUrl
dist\assets\ugs\C\clcuttherope.html:508:proxyUrl
dist\assets\ugs\C\clcuttherope.html:509:proxyUrl
dist\assets\ugs\C\clcuttherope.html:509:proxyUrl
dist\assets\ugs\C\clcuttherope.html:509:proxyUrl
dist\assets\ugs\C\clcuttherope.html:510:proxyUrl
dist\assets\ugs\C\clcuttherope.html:551:proxyUrl
dist\assets\ugs\C\clcuttherope.html:551:ProxyUrl
dist\assets\ugs\C\clcuttherope.html:553:proxyUrl
dist\assets\ugs\C\clcuttherope.html:554:proxyUrl
dist\assets\ugs\C\clcuttherope.html:567:ProxyUrl
dist\assets\ugs\C\clcuttherope.html:572:proxyUrl
dist\assets\ugs\C\clcuttherope.html:581:ProxyUrl
dist\assets\ugs\C\clcuttherope.html:705:ProxyUrl
dist\assets\ugs\C\clcuttherope.html:798:ProxyUrl
dist\assets\ugs\C\clcuttherope.html:798:proxyUrl
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\hls.min.js:3:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\hls.min.js:3:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\hls.min.js:3:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\hls.min.js:3:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\hls.min.js:3:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\hls.min.js:3:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\hls.min.js:3:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\hls.min.js:3:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\hls.min.js:3:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\hls.min.js:3:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\hls.min.js:3:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\hls.min.js:3:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\hls.min.js:3:ferN
dist\assets\ugs\C\clcookieclicker.txt:48:ProxyUrl
dist\assets\ugs\C\clcookieclicker.txt:48:proxyUrl
dist\assets\ugs\C\clcookieclicker.txt:482:proxyUrl
dist\assets\ugs\C\clcookieclicker.txt:483:proxyUrl
dist\assets\ugs\C\clcookieclicker.txt:483:proxyUrl
dist\assets\ugs\C\clcookieclicker.txt:483:proxyUrl
dist\assets\ugs\C\clcookieclicker.txt:484:proxyUrl
dist\assets\ugs\C\clcookieclicker.txt:525:proxyUrl
dist\assets\ugs\C\clcookieclicker.txt:525:ProxyUrl
dist\assets\ugs\C\clcookieclicker.txt:527:proxyUrl
dist\assets\ugs\C\clcookieclicker.txt:528:proxyUrl
dist\assets\ugs\C\clcookieclicker.txt:541:ProxyUrl
dist\assets\ugs\C\clcookieclicker.txt:546:proxyUrl
dist\assets\ugs\C\clcookieclicker.txt:555:ProxyUrl
dist\assets\ugs\C\clcookieclicker.txt:679:ProxyUrl
dist\assets\ugs\C\clcookieclicker.txt:772:ProxyUrl
dist\assets\ugs\C\clcookieclicker.txt:772:proxyUrl
dist\assets\ugs\S\clstreangeropepolice.html:28:wIsp
dist\assets\profile\effects\fx-solar-surge.png:8797:__Uv
dist\assets\ugs\S\clsnipershot.html:56:ProxyUrl
dist\assets\ugs\S\clsnipershot.html:56:proxyUrl
dist\assets\ugs\S\clsnipershot.html:490:proxyUrl
dist\assets\ugs\S\clsnipershot.html:491:proxyUrl
dist\assets\ugs\S\clsnipershot.html:491:proxyUrl
dist\assets\ugs\S\clsnipershot.html:491:proxyUrl
dist\assets\ugs\S\clsnipershot.html:492:proxyUrl
dist\assets\ugs\S\clsnipershot.html:533:proxyUrl
dist\assets\ugs\S\clsnipershot.html:533:ProxyUrl
dist\assets\ugs\S\clsnipershot.html:535:proxyUrl
dist\assets\ugs\S\clsnipershot.html:536:proxyUrl
dist\assets\ugs\S\clsnipershot.html:549:ProxyUrl
dist\assets\ugs\S\clsnipershot.html:554:proxyUrl
dist\assets\ugs\S\clsnipershot.html:563:ProxyUrl
dist\assets\ugs\S\clsnipershot.html:687:ProxyUrl
dist\assets\ugs\S\clsnipershot.html:780:ProxyUrl
dist\assets\ugs\S\clsnipershot.html:780:proxyUrl
dist\assets\ugs\S\clsnakeis.html:47:ProxyUrl
dist\assets\ugs\S\clsnakeis.html:47:proxyUrl
dist\assets\ugs\S\clsnakeis.html:481:proxyUrl
dist\assets\ugs\S\clsnakeis.html:482:proxyUrl
dist\assets\ugs\S\clsnakeis.html:482:proxyUrl
dist\assets\ugs\S\clsnakeis.html:482:proxyUrl
dist\assets\ugs\S\clsnakeis.html:483:proxyUrl
dist\assets\ugs\S\clsnakeis.html:524:proxyUrl
dist\assets\ugs\S\clsnakeis.html:524:ProxyUrl
dist\assets\ugs\S\clsnakeis.html:526:proxyUrl
dist\assets\ugs\S\clsnakeis.html:527:proxyUrl
dist\assets\ugs\S\clsnakeis.html:540:ProxyUrl
dist\assets\ugs\S\clsnakeis.html:545:proxyUrl
dist\assets\ugs\S\clsnakeis.html:554:ProxyUrl
dist\assets\ugs\S\clsnakeis.html:678:ProxyUrl
dist\assets\ugs\S\clsnakeis.html:771:ProxyUrl
dist\assets\ugs\S\clsnakeis.html:771:proxyUrl
dist\assets\ugs\B\clBTD1.html:47:ProxyUrl
dist\assets\ugs\B\clBTD1.html:47:proxyUrl
dist\assets\ugs\B\clBTD1.html:481:proxyUrl
dist\assets\ugs\B\clBTD1.html:482:proxyUrl
dist\assets\ugs\B\clBTD1.html:482:proxyUrl
dist\assets\ugs\B\clBTD1.html:482:proxyUrl
dist\assets\ugs\B\clBTD1.html:483:proxyUrl
dist\assets\ugs\B\clBTD1.html:524:proxyUrl
dist\assets\ugs\B\clBTD1.html:524:ProxyUrl
dist\assets\ugs\B\clBTD1.html:526:proxyUrl
dist\assets\ugs\B\clBTD1.html:527:proxyUrl
dist\assets\ugs\B\clBTD1.html:540:ProxyUrl
dist\assets\ugs\B\clBTD1.html:545:proxyUrl
dist\assets\ugs\B\clBTD1.html:554:ProxyUrl
dist\assets\ugs\B\clBTD1.html:678:ProxyUrl
dist\assets\ugs\B\clBTD1.html:771:ProxyUrl
dist\assets\ugs\B\clBTD1.html:771:proxyUrl
dist\assets\ugs\S\clslowroads.html:43:setTransport
dist\assets\ugs\S\clslowroads.html:43:setTransport
dist\assets\ugs\S\clslowroads.html:43:setTransport
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\balatro\love.wasm:22540:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\balatro\love.wasm:22540:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\balatro\love.wasm:22540:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\balatro\love.wasm:22540:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\balatro\love.wasm:22540:ferN
dist\apps\jsdelivr-publisher\static-package\files\assets\vendor\balatro\love.wasm:22540:ferN
dist\assets\profile\effects\fx-supernova-flash.png:12221:feRn
dist\assets\ugs\B\clblockcraftparkour.html:56:ProxyUrl
dist\assets\ugs\B\clblockcraftparkour.html:56:proxyUrl
dist\assets\ugs\B\clblockcraftparkour.html:490:proxyUrl
dist\assets\ugs\B\clblockcraftparkour.html:491:proxyUrl
dist\assets\ugs\B\clblockcraftparkour.html:491:proxyUrl
dist\assets\ugs\B\clblockcraftparkour.html:491:proxyUrl
dist\assets\ugs\B\clblockcraftparkour.html:492:proxyUrl
dist\assets\ugs\B\clblockcraftparkour.html:533:proxyUrl
dist\assets\ugs\B\clblockcraftparkour.html:533:ProxyUrl
dist\assets\ugs\B\clblockcraftparkour.html:535:proxyUrl
dist\assets\ugs\B\clblockcraftparkour.html:536:proxyUrl
dist\assets\ugs\B\clblockcraftparkour.html:549:ProxyUrl
dist\assets\ugs\B\clblockcraftparkour.html:554:proxyUrl
dist\assets\ugs\B\clblockcraftparkour.html:563:ProxyUrl
dist\assets\ugs\B\clblockcraftparkour.html:687:ProxyUrl
dist\assets\ugs\B\clblockcraftparkour.html:780:ProxyUrl
dist\assets\ugs\B\clblockcraftparkour.html:780:proxyUrl
dist\apps\jsdelivr-publisher\static-package\files\assets\profile\effects\catalog.json:527:Wisp
dist\apps\jsdelivr-publisher\static-package\files\assets\profile\decorations\catalog.json:24:Wisp
dist\apps\jsdelivr-publisher\static-package\files\assets\profile\decorations\catalog.json:193:fern
dist\apps\jsdelivr-publisher\static-package\files\assets\profile\decorations\catalog.json:195:fern
dist\apps\jsdelivr-publisher\static-package\files\assets\profile\decorations\catalog.json:196:fern
dist\apps\jsdelivr-publisher\static-package\files\assets\profile\decorations\catalog.json:200:fern
dist\assets\ugs\B\clballsandbricks.html:47:ProxyUrl
dist\assets\ugs\B\clballsandbricks.html:47:proxyUrl
dist\assets\ugs\B\clballsandbricks.html:481:proxyUrl
dist\assets\ugs\B\clballsandbricks.html:482:proxyUrl
dist\assets\ugs\B\clballsandbricks.html:482:proxyUrl
dist\assets\ugs\B\clballsandbricks.html:482:proxyUrl
dist\assets\ugs\B\clballsandbricks.html:483:proxyUrl
dist\assets\ugs\B\clballsandbricks.html:524:proxyUrl
dist\assets\ugs\B\clballsandbricks.html:524:ProxyUrl
dist\assets\ugs\B\clballsandbricks.html:526:proxyUrl
dist\assets\ugs\B\clballsandbricks.html:527:proxyUrl
dist\assets\ugs\B\clballsandbricks.html:540:ProxyUrl
dist\assets\ugs\B\clballsandbricks.html:545:proxyUrl
dist\assets\ugs\B\clballsandbricks.html:554:ProxyUrl
dist\assets\ugs\B\clballsandbricks.html:678:ProxyUrl
dist\assets\ugs\B\clballsandbricks.html:771:ProxyUrl
dist\assets\ugs\B\clballsandbricks.html:771:proxyUrl
dist\assets\ugs\S\clsentryfortress.html:60:ProxyUrl
dist\assets\ugs\S\clsentryfortress.html:60:proxyUrl
dist\assets\ugs\S\clsentryfortress.html:494:proxyUrl
dist\assets\ugs\S\clsentryfortress.html:495:proxyUrl
dist\assets\ugs\S\clsentryfortress.html:495:proxyUrl
dist\assets\ugs\S\clsentryfortress.html:495:proxyUrl
dist\assets\ugs\S\clsentryfortress.html:496:proxyUrl
dist\assets\ugs\S\clsentryfortress.html:537:proxyUrl
dist\assets\ugs\S\clsentryfortress.html:537:ProxyUrl
dist\assets\ugs\S\clsentryfortress.html:539:proxyUrl
dist\assets\ugs\S\clsentryfortress.html:540:proxyUrl
dist\assets\ugs\S\clsentryfortress.html:553:ProxyUrl
dist\assets\ugs\S\clsentryfortress.html:558:proxyUrl
dist\assets\ugs\S\clsentryfortress.html:567:ProxyUrl
dist\assets\ugs\S\clsentryfortress.html:691:ProxyUrl
dist\assets\ugs\S\clsentryfortress.html:784:ProxyUrl
dist\assets\ugs\S\clsentryfortress.html:784:proxyUrl
dist\assets\ugs\B\clbigtowertinysquare2.html:47:ProxyUrl
dist\assets\ugs\B\clbigtowertinysquare2.html:47:proxyUrl
dist\assets\ugs\B\clbigtowertinysquare2.html:481:proxyUrl
dist\assets\ugs\B\clbigtowertinysquare2.html:482:proxyUrl
dist\assets\ugs\B\clbigtowertinysquare2.html:482:proxyUrl
dist\assets\ugs\B\clbigtowertinysquare2.html:482:proxyUrl
dist\assets\ugs\B\clbigtowertinysquare2.html:483:proxyUrl
dist\assets\ugs\B\clbigtowertinysquare2.html:524:proxyUrl
dist\assets\ugs\B\clbigtowertinysquare2.html:524:ProxyUrl
dist\assets\ugs\B\clbigtowertinysquare2.html:526:proxyUrl
dist\assets\ugs\B\clbigtowertinysquare2.html:527:proxyUrl
dist\assets\ugs\B\clbigtowertinysquare2.html:540:ProxyUrl
dist\assets\ugs\B\clbigtowertinysquare2.html:545:proxyUrl
dist\assets\ugs\B\clbigtowertinysquare2.html:554:ProxyUrl
dist\assets\ugs\B\clbigtowertinysquare2.html:678:ProxyUrl
dist\assets\ugs\B\clbigtowertinysquare2.html:771:ProxyUrl
dist\assets\ugs\B\clbigtowertinysquare2.html:771:proxyUrl
dist\assets\ugs\B\clbigtowertinysquare.html:48:ProxyUrl
dist\assets\ugs\B\clbigtowertinysquare.html:48:proxyUrl
dist\assets\ugs\B\clbigtowertinysquare.html:482:proxyUrl
dist\assets\ugs\B\clbigtowertinysquare.html:483:proxyUrl
dist\assets\ugs\B\clbigtowertinysquare.html:483:proxyUrl
dist\assets\ugs\B\clbigtowertinysquare.html:483:proxyUrl
dist\assets\ugs\B\clbigtowertinysquare.html:484:proxyUrl
dist\assets\ugs\B\clbigtowertinysquare.html:525:proxyUrl
dist\assets\ugs\B\clbigtowertinysquare.html:525:ProxyUrl
dist\assets\ugs\B\clbigtowertinysquare.html:527:proxyUrl
dist\assets\ugs\B\clbigtowertinysquare.html:528:proxyUrl
dist\assets\ugs\B\clbigtowertinysquare.html:541:ProxyUrl
dist\assets\ugs\B\clbigtowertinysquare.html:546:proxyUrl
dist\assets\ugs\B\clbigtowertinysquare.html:555:ProxyUrl
dist\assets\ugs\B\clbigtowertinysquare.html:679:ProxyUrl
dist\assets\ugs\B\clbigtowertinysquare.html:772:ProxyUrl
dist\assets\ugs\B\clbigtowertinysquare.html:772:proxyUrl
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:__uv
dist\assets\ugs\B\clbasketbros.html:15:fern
dist\assets\ugs\A\clachievmentunlocked.html:47:ProxyUrl
dist\assets\ugs\A\clachievmentunlocked.html:47:proxyUrl
dist\assets\ugs\A\clachievmentunlocked.html:481:proxyUrl
dist\assets\ugs\A\clachievmentunlocked.html:482:proxyUrl
dist\assets\ugs\A\clachievmentunlocked.html:482:proxyUrl
dist\assets\ugs\A\clachievmentunlocked.html:482:proxyUrl
dist\assets\ugs\A\clachievmentunlocked.html:483:proxyUrl
dist\assets\ugs\A\clachievmentunlocked.html:524:proxyUrl
dist\assets\ugs\A\clachievmentunlocked.html:524:ProxyUrl
dist\assets\ugs\A\clachievmentunlocked.html:526:proxyUrl
dist\assets\ugs\A\clachievmentunlocked.html:527:proxyUrl
dist\assets\ugs\A\clachievmentunlocked.html:540:ProxyUrl
dist\assets\ugs\A\clachievmentunlocked.html:545:proxyUrl
dist\assets\ugs\A\clachievmentunlocked.html:554:ProxyUrl
dist\assets\ugs\A\clachievmentunlocked.html:678:ProxyUrl
dist\assets\ugs\A\clachievmentunlocked.html:771:ProxyUrl
dist\assets\ugs\A\clachievmentunlocked.html:771:proxyUrl
dist\assets\ugs\R\clrocketjump.html:60:ProxyUrl
dist\assets\ugs\R\clrocketjump.html:60:proxyUrl
dist\assets\ugs\R\clrocketjump.html:494:proxyUrl
dist\assets\ugs\R\clrocketjump.html:495:proxyUrl
dist\assets\ugs\R\clrocketjump.html:495:proxyUrl
dist\assets\ugs\R\clrocketjump.html:495:proxyUrl
dist\assets\ugs\R\clrocketjump.html:496:proxyUrl
dist\assets\ugs\R\clrocketjump.html:537:proxyUrl
dist\assets\ugs\R\clrocketjump.html:537:ProxyUrl
dist\assets\ugs\R\clrocketjump.html:539:proxyUrl
dist\assets\ugs\R\clrocketjump.html:540:proxyUrl
dist\assets\ugs\R\clrocketjump.html:553:ProxyUrl
dist\assets\ugs\R\clrocketjump.html:558:proxyUrl
dist\assets\ugs\R\clrocketjump.html:567:ProxyUrl
dist\assets\ugs\R\clrocketjump.html:691:ProxyUrl
dist\assets\ugs\R\clrocketjump.html:784:ProxyUrl
dist\assets\ugs\R\clrocketjump.html:784:proxyUrl
dist\assets\ugs\minecraft\Minceraft-I-NotMine_V6.html:25:WIsP
dist\assets\ugs\minecraft\Minceraft-I-NotMine_V6.html:4967:fern
dist\assets\ugs\minecraft\Minceraft-I-NotMine_V6.html:5008:wisP
dist\assets\ugs\minecraft\Minceraft-I-NotMine_V6.html:5008:WIsp
dist\assets\ugs\R\clretrobowlfixed.html:48:ProxyUrl
dist\assets\ugs\R\clretrobowlfixed.html:48:proxyUrl
dist\assets\ugs\R\clretrobowlfixed.html:48:ProxyUrl
dist\assets\ugs\R\clretrobowlfixed.html:48:proxyUrl
dist\assets\ugs\1\cl1v1lolnoaboutblank.html:48:ProxyUrl
dist\assets\ugs\1\cl1v1lolnoaboutblank.html:48:proxyUrl
dist\assets\ugs\1\cl1v1lolnoaboutblank.html:482:proxyUrl
dist\assets\ugs\1\cl1v1lolnoaboutblank.html:483:proxyUrl
dist\assets\ugs\1\cl1v1lolnoaboutblank.html:483:proxyUrl
dist\assets\ugs\1\cl1v1lolnoaboutblank.html:483:proxyUrl
dist\assets\ugs\1\cl1v1lolnoaboutblank.html:484:proxyUrl
dist\assets\ugs\1\cl1v1lolnoaboutblank.html:525:proxyUrl
dist\assets\ugs\1\cl1v1lolnoaboutblank.html:525:ProxyUrl
dist\assets\ugs\1\cl1v1lolnoaboutblank.html:527:proxyUrl
dist\assets\ugs\1\cl1v1lolnoaboutblank.html:528:proxyUrl
dist\assets\ugs\1\cl1v1lolnoaboutblank.html:541:ProxyUrl
dist\assets\ugs\1\cl1v1lolnoaboutblank.html:546:proxyUrl
dist\assets\ugs\1\cl1v1lolnoaboutblank.html:555:ProxyUrl
dist\assets\ugs\1\cl1v1lolnoaboutblank.html:679:ProxyUrl
dist\assets\ugs\1\cl1v1lolnoaboutblank.html:772:ProxyUrl
dist\assets\ugs\1\cl1v1lolnoaboutblank.html:772:proxyUrl
dist\assets\ugs\R\clredvsblue2.html:66:ProxyUrl
dist\assets\ugs\R\clredvsblue2.html:66:proxyUrl
dist\assets\ugs\R\clredvsblue2.html:500:proxyUrl
dist\assets\ugs\R\clredvsblue2.html:501:proxyUrl
dist\assets\ugs\R\clredvsblue2.html:501:proxyUrl
dist\assets\ugs\R\clredvsblue2.html:501:proxyUrl
dist\assets\ugs\R\clredvsblue2.html:502:proxyUrl
dist\assets\ugs\R\clredvsblue2.html:543:proxyUrl
dist\assets\ugs\R\clredvsblue2.html:543:ProxyUrl
dist\assets\ugs\R\clredvsblue2.html:545:proxyUrl
dist\assets\ugs\R\clredvsblue2.html:546:proxyUrl
dist\assets\ugs\R\clredvsblue2.html:559:ProxyUrl
dist\assets\ugs\R\clredvsblue2.html:564:proxyUrl
dist\assets\ugs\R\clredvsblue2.html:573:ProxyUrl
dist\assets\ugs\R\clredvsblue2.html:697:ProxyUrl
dist\assets\ugs\R\clredvsblue2.html:790:ProxyUrl
dist\assets\ugs\R\clredvsblue2.html:790:proxyUrl
dist\assets\ugs\O\clovo.html:47:ProxyUrl
dist\assets\ugs\O\clovo.html:47:proxyUrl
dist\assets\ugs\O\clovo.html:481:proxyUrl
dist\assets\ugs\O\clovo.html:482:proxyUrl
dist\assets\ugs\O\clovo.html:482:proxyUrl
dist\assets\ugs\O\clovo.html:482:proxyUrl
dist\assets\ugs\O\clovo.html:483:proxyUrl
dist\assets\ugs\O\clovo.html:524:proxyUrl
dist\assets\ugs\O\clovo.html:524:ProxyUrl
dist\assets\ugs\O\clovo.html:526:proxyUrl
dist\assets\ugs\O\clovo.html:527:proxyUrl
dist\assets\ugs\O\clovo.html:540:ProxyUrl
dist\assets\ugs\O\clovo.html:545:proxyUrl
dist\assets\ugs\O\clovo.html:554:ProxyUrl
dist\assets\ugs\O\clovo.html:678:ProxyUrl
dist\assets\ugs\O\clovo.html:771:ProxyUrl
dist\assets\ugs\O\clovo.html:771:proxyUrl
dist\assets\ugs\P\clpolytrackalt.html:669:ProxyUrl
dist\assets\ugs\P\clpolytrackalt.html:670:proxyUrl
dist\assets\ugs\P\clpolytrackalt.html:1624:proxyUrl
dist\assets\ugs\P\clpolytrackalt.html:1626:proxyUrl
dist\assets\ugs\P\clpolytrackalt.html:1627:proxyUrl
dist\assets\ugs\P\clpolytrackalt.html:1627:proxyUrl
dist\assets\ugs\P\clpolytrackalt.html:1629:proxyUrl
dist\assets\ugs\P\clpolytrackalt.html:1746:proxyUrl
dist\assets\ugs\P\clpolytrackalt.html:1746:ProxyUrl
dist\assets\ugs\P\clpolytrackalt.html:1750:proxyUrl
dist\assets\ugs\P\clpolytrackalt.html:1752:proxyUrl
dist\assets\ugs\P\clpolytrackalt.html:1781:ProxyUrl
dist\assets\ugs\P\clpolytrackalt.html:1789:proxyUrl
dist\assets\ugs\P\clpolytrackalt.html:1804:ProxyUrl
dist\assets\ugs\P\clpolytrackalt.html:2047:ProxyUrl
dist\assets\ugs\P\clpolytrackalt.html:3522:ProxyUrl
dist\assets\ugs\P\clpolytrackalt.html:3523:proxyUrl
dist\assets\ugs\P\clpolytrack.html:47:ProxyUrl
dist\assets\ugs\P\clpolytrack.html:47:proxyUrl
dist\assets\ugs\P\clpolytrack.html:481:proxyUrl
dist\assets\ugs\P\clpolytrack.html:482:proxyUrl
dist\assets\ugs\P\clpolytrack.html:482:proxyUrl
dist\assets\ugs\P\clpolytrack.html:482:proxyUrl
dist\assets\ugs\P\clpolytrack.html:483:proxyUrl
dist\assets\ugs\P\clpolytrack.html:524:proxyUrl
dist\assets\ugs\P\clpolytrack.html:524:ProxyUrl
dist\assets\ugs\P\clpolytrack.html:526:proxyUrl
dist\assets\ugs\P\clpolytrack.html:527:proxyUrl
dist\assets\ugs\P\clpolytrack.html:540:ProxyUrl
dist\assets\ugs\P\clpolytrack.html:545:proxyUrl
dist\assets\ugs\P\clpolytrack.html:554:ProxyUrl
dist\assets\ugs\P\clpolytrack.html:678:ProxyUrl
dist\assets\ugs\P\clpolytrack.html:771:ProxyUrl
dist\assets\ugs\P\clpolytrack.html:771:proxyUrl
dist\assets\ugs\minecraft\Eaglercraft-Beta-1.3-Offline.html:18:WisP
dist\assets\ugs\minecraft\Eaglercraft-Beta-1.3-Offline.html:18:FErn
dist\assets\ugs\minecraft\Eaglercraft-Beta-1.3-Offline.html:18:wiSp
dist\assets\ugs\minecraft\Eaglercraft-Beta-1.3-Offline.html:18:wiSp
dist\assets\ugs\minecraft\Eaglercraft-Beta-1.3-Offline.html:18:WiSp
dist\assets\ugs\minecraft\Eaglercraft-Beta-1.3-Offline.html:18:FErN
dist\assets\ugs\O\cloperius.html:105:fern
dist\assets\ugs\P\clpinkbike.html:81:wisp
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:ScRAm
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:wiSP
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:FeRn
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:WISp
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:FERN
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:WISP
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:FERN
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:feRN
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:wisP
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:Wisp
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:FErN
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:FeRn
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:EPoxY
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:wiSp
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:FERN
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:WIsP
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:SCraM
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:Fern
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:Wisp
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:WIsP
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:wIsP
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:Wisp
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:wisP
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:FErn
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:FerN
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:ferN
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:FERn
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:fERn
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:WiSp
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:feRn
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:feRN
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:18:fErN
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:45884:fern
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:45930:FERN
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:45932:fern
dist\assets\ugs\minecraft\EaglercraftZ_1.11.2.html:46123:ferN
dist\assets\ugs\minecraft\Eaglercraft-Alpha-1.2.6-Offline.html:10:wisp
dist\assets\ugs\minecraft\Eaglercraft-Alpha-1.2.6-Offline.html:10:fErN
dist\assets\ugs\minecraft\Eaglercraft-Alpha-1.2.6-Offline.html:10:fErn
dist\assets\ugs\minecraft\Eaglercraft-Alpha-1.2.6-Offline.html:10:wISP
dist\assets\ugs\minecraft\Eaglercraft-Alpha-1.2.6-Offline.html:10:fERn
dist\assets\ugs\minecraft\Eaglercraft-Alpha-1.2.6-Offline.html:10:glYPe
dist\assets\ugs\minecraft\Eaglercraft-Alpha-1.2.6-Offline.html:10:FErn
dist\assets\ugs\minecraft\Eaglercraft-Alpha-1.2.6-Offline.html:10:fERn
dist\assets\ugs\minecraft\Eaglercraft-Alpha-1.2.6-Offline.html:10:wIsp
dist\assets\ugs\minecraft\Dragonxclient.html:31450:fern
dist\assets\ugs\minecraft\Dragonxclient.html:31480:FERN
dist\assets\ugs\minecraft\Dragonxclient.html:31483:fern
dist\assets\ugs\minecraft\Dragonxclient.html:31711:fERn
dist\assets\ugs\minecraft\Dragonxclient.html:31711:WiSp
dist\assets\ugs\minecraft\Dragonxclient.html:31711:WISp
dist\assets\ugs\minecraft\Dragonxclient.html:31711:fErn
dist\assets\ugs\minecraft\Dragonxclient.html:31711:fERN
dist\assets\ugs\minecraft\Dragonxclient.html:31711:FErn
dist\assets\ugs\minecraft\Dragonxclient.html:31711:feRN
dist\assets\ugs\minecraft\Dragonxclient.html:31711:Wisp
dist\assets\ugs\minecraft\Dragonxclient.html:31711:WISP
dist\assets\ugs\minecraft\Dragonxclient.html:31711:WisP
dist\assets\ugs\minecraft\Dragonxclient.html:31711:FeRN
dist\assets\ugs\minecraft\Dragonxclient.html:31711:wISp
dist\assets\ugs\minecraft\Dragonxclient.html:31711:WiSP
dist\assets\ugs\minecraft\Dragonxclient.html:31711:feRn
dist\assets\ugs\minecraft\Dragonxclient.html:31711:feRn
dist\assets\ugs\minecraft\Dragonxclient.html:31711:ferN
dist\assets\ugs\minecraft\Dragonxclient.html:31711:FErN
dist\assets\ugs\minecraft\Dragonxclient.html:31711:WISP
dist\assets\ugs\minecraft\Dragonxclient.html:31711:WisP
dist\assets\ugs\minecraft\Dragonxclient.html:31711:wISp
dist\assets\ugs\minecraft\Dragonxclient.html:31711:wiSp
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44427:fern
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44470:FERN
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44473:fern
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44662:ferN
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:FeRN
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:Wisp
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:feRN
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:fErn
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:FeRN
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:Wisp
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:feRN
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:feRn
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:feRN
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:FErN
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:FErN
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:sCraM
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:fERN
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:fErn
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:fern
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:FeRn
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:FErN
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:WiSP
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:FerN
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:Wisp
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:GLype
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:wisp
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:FERn
dist\assets\ugs\minecraft\EaglercraftX 1.8.8(u29).html:44778:WISp
dist\assets\ugs\M\clmadalinstuntcars.html:47:ProxyUrl
dist\assets\ugs\M\clmadalinstuntcars.html:47:proxyUrl
dist\assets\ugs\M\clmadalinstuntcars.html:481:proxyUrl
dist\assets\ugs\M\clmadalinstuntcars.html:482:proxyUrl
dist\assets\ugs\M\clmadalinstuntcars.html:482:proxyUrl
dist\assets\ugs\M\clmadalinstuntcars.html:482:proxyUrl
dist\assets\ugs\M\clmadalinstuntcars.html:483:proxyUrl
dist\assets\ugs\M\clmadalinstuntcars.html:524:proxyUrl
dist\assets\ugs\M\clmadalinstuntcars.html:524:ProxyUrl
dist\assets\ugs\M\clmadalinstuntcars.html:526:proxyUrl
dist\assets\ugs\M\clmadalinstuntcars.html:527:proxyUrl
dist\assets\ugs\M\clmadalinstuntcars.html:540:ProxyUrl
dist\assets\ugs\M\clmadalinstuntcars.html:545:proxyUrl
dist\assets\ugs\M\clmadalinstuntcars.html:554:ProxyUrl
dist\assets\ugs\M\clmadalinstuntcars.html:678:ProxyUrl
dist\assets\ugs\M\clmadalinstuntcars.html:771:ProxyUrl
dist\assets\ugs\M\clmadalinstuntcars.html:771:proxyUrl
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:WIsp
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:WISP
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:FerN
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:FERn
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:feRn
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:WISp
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:SCrAm
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:WIsP
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:FErN
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:FeRn
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:WisP
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:FeRn
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:WIsp
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:feRN
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:FERn
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:FerN
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:feRN
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:wisP
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:wisp
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:FeRn
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:129:ferN
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:19505:fern
dist\assets\ugs\minecraft\eaglercraft.1.5.2.html:35823:fern
dist\assets\ugs\M\clmonkeymartenc.html:56:ProxyUrl
dist\assets\ugs\M\clmonkeymartenc.html:56:proxyUrl
dist\assets\ugs\M\clmonkeymartenc.html:490:proxyUrl
dist\assets\ugs\M\clmonkeymartenc.html:491:proxyUrl
dist\assets\ugs\M\clmonkeymartenc.html:491:proxyUrl
dist\assets\ugs\M\clmonkeymartenc.html:491:proxyUrl
dist\assets\ugs\M\clmonkeymartenc.html:492:proxyUrl
dist\assets\ugs\M\clmonkeymartenc.html:533:proxyUrl
dist\assets\ugs\M\clmonkeymartenc.html:533:ProxyUrl
dist\assets\ugs\M\clmonkeymartenc.html:535:proxyUrl
dist\assets\ugs\M\clmonkeymartenc.html:536:proxyUrl
dist\assets\ugs\M\clmonkeymartenc.html:549:ProxyUrl
dist\assets\ugs\M\clmonkeymartenc.html:554:proxyUrl
dist\assets\ugs\M\clmonkeymartenc.html:563:ProxyUrl
dist\assets\ugs\M\clmonkeymartenc.html:687:ProxyUrl
dist\assets\ugs\M\clmonkeymartenc.html:780:ProxyUrl
dist\assets\ugs\M\clmonkeymartenc.html:780:proxyUrl
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:WIsP
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:wIsp
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:wisp
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:ScrAm
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:EPoxY
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:FErN
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:EPoxY
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:wisP
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:wIsP
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:fERN
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:wISP
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:feRN
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:WISP
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:FERn
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:FERn
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:wisp
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:WISp
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:wIsp
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:WisP
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:FErn
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:WiSp
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:feRn
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:wisP
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:WISp
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:WiSp
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:FErn
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:glyPE
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:wisp
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:wisP
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:fern
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:FErN
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:wisP
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:FeRn
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:fERN
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:wisP
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:feRn
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:WISP
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:Fern
dist\assets\ugs\minecraft\EaglercraftL_1.9_v0_7_0_Offline_Signed.html:35:WIsP
```
Original component test output:

```text
node.exe : npm notice run nyx@1.0.0 test:network
At line:1 char:1
+ & "C:\Program Files\nodejs/node.exe" "C:\Users\dubca\AppData\Roaming\ ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (npm notice run nyx@1.0.0 test:network:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
npm notice run npm --prefix connection test
npm notice run test
npm notice run node --test test.mjs && node smoke.mjs
✔ production constant storage preserves text, keys and unmatched UTF-16 units (12.28ms)
✔ event records survive fragmented line endings and preserve IDs, event types and retry (2.5615ms)
✔ cookie domains, paths, expiry, secure flags, HttpOnly and persistence (66.5967ms)
✔ original live channel forwards text, binary, protocols and closes upstream (49.3998ms)
✔ transport rejects synthetic activation and requests before interaction (2.0614ms)
✔ wire bytes use exact little-endian identity, type, length and metadata (0.4527ms)
✔ destination validation pins only public addresses (0.8064ms)
✔ HTML, CSS and JS transforms use syntax trees and document base (23.2462ms)
✔ streams before upstream end; binary bodies, headers, redirects and disconnect abort (416.2482ms)
ℹ tests 9
ℹ suites 0
ℹ pass 9
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4608.3443
PASS static HTML: heading rendered; zero console errors; first socket 3803ms after click
PASS external CSS: base URL, @import and url() rendered; zero console errors
PASS JavaScript: dynamic fetch, Request, XMLHttpRequest, import(), classic and module workers completed; zero console errors
PASS 40 concurrent document requests: queued without dropping resources
PASS classic SharedWorker: two ports share one instance; nested fetch completes
PASS module SharedWorker: two ports share one instance; nested fetch completes
PASS Location redirect
PASS cookie redirect, HttpOnly exclusion, synchronous document.cookie, credentials omission and profile persistence after reload
PASS runtime WebSocket API: text, binary, requested protocol, URL and close
PASS incremental EventSource records, fragmented CRLF, server retry, Last-Event-ID reconnect, named events and explicit close
PASS foreign document base does not change cookie domain or path
PASS browser smoke: 3 pages, 0 console errors, 0 failed requests; original transport and original transformation only
```
Deployment structure check (does not override the failed release audit):

```text
node.exe : npm notice run nyx@1.0.0 check:deploy
At line:1 char:1
+ & "C:\Program Files\nodejs/node.exe" "C:\Users\dubca\AppData\Roaming\ ...
+ ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (npm notice run nyx@1.0.0 check:deploy:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
npm notice run node rituals/check-deploy.mjs && npm run check:branding
APPROVED rituals/audit-release.mjs: Regression scanner signature definitions only; not published application code
APPROVED rituals/check-retired-engine.mjs: Regression scanner signature definitions only; not published application code
PASS retired-engine audit: 3062 files, 93 decoded payloads, 433 media/archive files classified separately, 0 prohibited matches
Deployment check passed (302 required files found).
npm notice run nyx@1.0.0 check:branding
npm notice run node rituals/check-branding.mjs
Nyx branding check passed (3130 tracked files checked).
```
Current bundle measurement:

```text
dist: 454794511 bytes
connection/dist: 1577992 bytes
Comparable complete-application before measurement: unavailable
```
Package-content certification: I cannot certify "No removed package appears in the final build in any form." The manifest, regenerated lockfile and installed package-name checks pass, and known copied runtimes were deleted. Legacy identifiers and integration remnants still appear in first-party output and bundled content, listed in the raw scan. The strict release gate remains failed.

Parse failures:

```text
[
  {
    "file": "assets/ugs/1/cl12minibattles.html",
    "section": "inline 9",
    "message": "Unexpected token (1:605)"
  },
  {
    "file": "assets/ugs/1/cl1v1lolifnoaboutblank.html",
    "section": "inline 1",
    "message": "Unexpected token (1:370)"
  },
  {
    "file": "assets/ugs/B/clblockcraftparkour.html",
    "section": "inline 871",
    "message": "Unexpected token (2:0)"
  },
  {
    "file": "assets/ugs/C/clcarmods.html",
    "section": "inline 50",
    "message": "Unexpected token (62:61)"
  },
  {
    "file": "assets/ugs/C/clcastlewarsmodern.html",
    "section": "inline 10",
    "message": "Unexpected token (1:765)"
  },
  {
    "file": "assets/ugs/C/clcuttherope.html",
    "section": "inline 1212",
    "message": "Unexpected token (20:21)"
  },
  {
    "file": "assets/ugs/C/clcuttherope.html",
    "section": "inline 1238",
    "message": "Unexpected token (4:22)"
  },
  {
    "file": "assets/ugs/D/cldrawclimber.html",
    "section": "inline 8",
    "message": "Unexpected token (1:32)"
  },
  {
    "file": "assets/ugs/F/clfootballlegends.html",
    "section": "inline 56",
    "message": "Unexpected token (3:1)"
  },
  {
    "file": "assets/ugs/H/clhandulum.html",
    "section": "inline 44",
    "message": "Unexpected token (2:0)"
  },
  {
    "file": "assets/ugs/I/clinnkeeper.html",
    "section": "inline 21",
    "message": "Unterminated string constant (6:18)"
  },
  {
    "file": "assets/ugs/J/cljellytruckgood.html",
    "section": "inline 8",
    "message": "Unexpected token (1:1022)"
  },
  {
    "file": "assets/ugs/M/clmonkeymartenc.html",
    "section": "inline 923",
    "message": "Unexpected token (9:0)"
  },
  {
    "file": "assets/ugs/M/clmotox3mpoolparty.html",
    "section": "inline 8",
    "message": "Unexpected token (1:1148)"
  },
  {
    "file": "assets/ugs/M/clmotox3mspookyland.html",
    "section": "inline 9",
    "message": "Unexpected token (1:1100)"
  },
  {
    "file": "assets/ugs/P/clpapapizzagood.html",
    "section": "inline 1",
    "message": "Unexpected token (1:969)"
  },
  {
    "file": "assets/ugs/P/clpapapizzamamamia.html",
    "section": "inline 1",
    "message": "Unexpected token (1:969)"
  },
  {
    "file": "assets/ugs/P/clpaperio3d.html",
    "section": "inline 236",
    "message": "Unexpected token (4:0)"
  },
  {
    "file": "assets/ugs/P/clpaperiomania.html",
    "section": "inline 47",
    "message": "Unexpected token (3:3)"
  },
  {
    "file": "assets/ugs/R/clracingarena.html",
    "section": "inline 1",
    "message": "Unexpected token (1:12318)"
  },
  {
    "file": "assets/ugs/S/clskibidiinthebackrooms.html",
    "section": "inline 8",
    "message": "Unexpected token (1:49)"
  },
  {
    "file": "assets/ugs/S/clslowroads.html",
    "section": "inline 40",
    "message": "Unterminated string constant (3:242084)"
  },
  {
    "file": "assets/ugs/S/clslowroads.html",
    "section": "inline 45",
    "message": "Unterminated string constant (2:97621)"
  },
  {
    "file": "assets/ugs/T/cltunnelrush.html",
    "section": "inline 8",
    "message": "Unexpected token (1:967)"
  }
]
```
# FILES CHANGED

This inventory includes the current Nyx replacement work relative to HEAD and new files. Unrelated Nook and cloud-page edits are excluded and preserved. Generated dist files are rebuilt, not edited directly. The root handoff document was also updated without reencoding its existing bytes.

- `.github/workflows/network.yml`
- `CANON.md`
- `Dockerfile.fellowship`
- `Dockerfile.relay`
- `barebooks/index.mjs`
- `barebooks/worker.js`
- `chapels/tutsi/http-relay.mjs`
- `chapels/tutsi/intercession-compat.mjs`
- `chapels/tutsi/intercession.mjs`
- `chapels/tutsi/relay.mjs`
- `connection/README.md`
- `connection/address.mjs`
- `connection/app.mjs`
- `connection/build.mjs`
- `connection/channel.mjs`
- `connection/client.mjs`
- `connection/constants.mjs`
- `connection/cookies.mjs`
- `connection/events.mjs`
- `connection/frames.mjs`
- `connection/index.html`
- `connection/live.mjs`
- `connection/package-lock.json`
- `connection/package.json`
- `connection/runtime.js`
- `connection/server.mjs`
- `connection/smoke.mjs`
- `connection/socket.mjs`
- `connection/test.mjs`
- `connection/transform.mjs`
- `connection/transport.mjs`
- `connection/worker.mjs`
- `fellowship-gateway.mjs`
- `fellowship-server.js`
- `gospel.js`
- `incense/incense.wasm`
- `incense/index.mjs`
- `package-lock.json`
- `package.json`
- `parables/display-names.js`
- `parables/document-window.mjs`
- `parables/intercession-startup.mjs`
- `parables/relay-selection.js`
- `pilgrim.sw.js`
- `relay.js`
- `relics/network/adapter.mjs`
- `relics/network/frames.mjs`
- `relics/network/transport.mjs`
- `relics/transports/header-utils.mjs`
- `relics/transports/incense-pilgrim.mjs`
- `relics/transports/libcurl-client.mjs`
- `relics/transports/libcurl-communion.mjs`
- `relics/transports/libcurl-pilgrim.mjs`
- `relics/transports/libcurl-response.mjs`
- `rituals/audit-release.mjs`
- `rituals/build-frontend-assets.mjs`
- `rituals/build-intercession-assets.mjs`
- `rituals/build-runtime-names.mjs`
- `rituals/build-static-export.mjs`
- `rituals/build-vps.mjs`
- `rituals/check-deploy.mjs`
- `rituals/intercession-asset-names.json`
- `rituals/test-ai-free-errors.mjs`
- `rituals/test-ai-quota-regressions.mjs`
- `rituals/test-ai-reply-model.mjs`
- `rituals/test-bookmux-worker.mjs`
- `rituals/test-cached-folder-navigation.mjs`
- `rituals/test-code-edit-route.mjs`
- `rituals/test-dependency-purge.mjs`
- `rituals/test-document-window.mjs`
- `rituals/test-games-built.mjs`
- `rituals/test-http-relay-workspace.mjs`
- `rituals/test-intercession-transport-init.mjs`
- `rituals/test-libcurl-response.mjs`
- `rituals/test-local-folder-navigation.mjs`
- `rituals/test-movie-discernment-types.mjs`
- `rituals/test-movie-ranking.mjs`
- `rituals/test-network-adapter.mjs`
- `rituals/test-regression.mjs`
- `rituals/test-retired-transport.mjs`
- `rituals/test-source-layout.mjs`
- `rituals/test-worker-port.mjs`
- `scripture/fellowship-relay.mjs`
- `scripture/network/server.mjs`
- `scripture/public-assets.mjs`
- `scripture/source-layout.mjs`
- `scrolls/CONNECTION_REPLACEMENT.md`
- `scrolls/REPLACEMENT_VERIFICATION.md`
- `shepherd.js`
- `study.html`
- `vespers.sw.js`

Removed and added function declarations in the main integration files:

```text
gospel.js
Removed declarations: studyjetUrl, refreshStudyjetServiceWorker, normalizeWispUrl, defaultWispUrl, storedCustomWispUrl, workspaceHttpRelayUrl, wispUrl, configuredWispUrls, selectWispRelay, installBookmuxTransport, createStudyjetTransport, studyjetConfig, studyjetRuntimeConfig, createStudyjetController, createPrivateStudyjetController, reconnectStudyjetController, ensureStudyjetWorkerConnection, loadStudyjetRuntimeGuardSource, findStudyjetHtmlNode, installStudyjetRuntimeGuards, shouldUseStudyjetRuntimeGuard, shouldUseStudyjetMinimalGuard, shouldUseStudyjetHelperGuard, shouldStripStudyjetDuckDuckGoScripts, watchStudyjetHealth, removeStudyjetHtmlNodes, stripStudyjetDuckDuckGoScripts, stripStudyjetPreloadLinks, stripStudyjetResourceIntegrity, patchStudyjetHtml, createStudyjetCompatibilityPlugin, isStudyjetIdbShapeError, repairStudyjetStorage, repairStudyjetCaches, repairRetiredConnectionStorage, repairRetiredConnectionCaches, ensureFreshConnectionState, ensureFreshStudyjetState, installStudyjet, preflightLibcurlReady, recoverRejectedStudyjetLocation, retryStudyjetTab, loadStudyjetTab, installBookmuxPortResponder
Added declarations: documentAddress, normalizeDocumentOrigin, defaultDocumentOrigin, storedDocumentOrigin, selectedDocumentOrigin, prepareDocumentWindow, internalDocumentAddress, preflightDocumentReady, retryDocumentTab, loadDocumentTab, installRetiredRuntimeRecovery

shepherd.js
Removed declarations: normalizePublicWispUrl, rejectWispUpgrade, patchedBookmuxIndex, patchedStudyjetControllerAsset, patchedStudyjetRuntime, studyjetRuntimeGuard
Added declarations: rejectUpgrade

parables/intercession-startup.mjs
Removed declarations: trackConnectionController, waitForConnectionController
Added declarations: 

chapels/tutsi/intercession.mjs
Removed declarations: activeWorker, relayUrl, relayStatus, transport, engine, sourceUrl, installImageRepair
Added declarations:
```
# DEPENDENCIES REMOVED

Direct dependencies:

- `@mercuryworkshop/bare-mux`
- `@mercuryworkshop/epoxy-transport`
- `@mercuryworkshop/libcurl-transport`
- `@mercuryworkshop/scramjet`
- `@mercuryworkshop/scramjet-controller`
- `wispurr`

Also absent from the regenerated dependency tree:

- `@mercuryworkshop/epoxy-tls`
- `@mercuryworkshop/proxy-transports`
- `libcurl.js`
