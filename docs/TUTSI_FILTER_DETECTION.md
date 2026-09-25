# Tutsi filter detection comparison

## Loaded-resource detection and diagnostics (2026-09-19)

The scanner now combines public-resource probes with already-loaded extension images and stylesheets. A known extension image must have decoded dimensions; a stylesheet must have a loaded sheet. This recovers evidence when a fresh fetch fails. Merely finding a known extension URL in a DOM node is reported as an unverified hint, never used for automatic relay ranking. Hidden resources, errors and timeouts do not establish that an extension is absent. No script is executed, and no extension contents or browsing history are read.

Settings includes per-vendor Detection details for all 17 supported historical product families. Manual choices still take precedence. Response-body cancellation no longer blocks scan completion. `test-tutsi-filter-report.mjs` verifies a real unpacked extension stylesheet with a denied re-fetch, failed resources, unverified addresses, timeouts and stalled cancellation. Managed Chromebook coverage remains unverified; Chrome deliberately restricts website access to extension resources (https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources).

Local evaluation on 2026-09-16. No managed Chromebook was available.

## Compared implementations

1. https://github.com/HughParry/chrome-extension-identifier (MIT), specifically detector/src/core/probe.ts. Tested the upstream probeFetch function after removing TypeScript types, and Tutsi's bounded implementation, against an actual unpacked test extension in isolated Chromium profiles. Both returned false/Unknown when absent and positive when present. Attribution is bundled at apps/tutsi/licenses/extension-identifier.txt.
2. https://gist.github.com/BinBashBanana/a1fd7345e2d86e69d5a532f16cbdbdaa. Ran the original script against a synthetic page containing its known proxy markers, with no extensions installed. It matched both Securly and GoGuardian. This is expected for a page-content classifier, but would be a false attribution if presented as blocker detection. It is not included in Tutsi.

Downloaded comparison sources and results.json are preserved locally under .codex-artifacts/filter-comparison/. The comparison test requires these downloaded sources; scripts/test-tutsi-filter-ui.mjs and scripts/test-tutsi-relay.mjs are self-contained fixtures. No third-party detector is loaded remotely by Tutsi.

## Signature limits

The selected project's generated registry did not contain these school filters. The 20 extension ID/resource pairs are historical public resource references from https://github.com/ading2210/dextensify/blob/master/main.html. Only factual resource addresses are used; no disabling/crashing code is copied or run. This source's existence does not establish current resource exposure. Attempts to obtain current extension packages from Google's public update endpoint returned 404; signatures remain best-effort and require managed-device verification. The newer Securly ID ckecmkbnoanpgplccmnoikfmpcdladkc is documented by Securly but is not probed because no exposed resource was verified for it.

Positive means an exposed extension resource responded, not proof that it blocked a relay. No response, unsupported vendor, hidden resource, timeout or network-only filtering all remain Unknown. A device can have more than one filter. We do not choose a vendor by counting unrelated page keywords, failed requests or retries. Manual selection overrides automatic hints. Connection failover is independent of detection success.

## Further alternatives reviewed

- https://github.com/uhidontkno/filtercheckerv2 provides URL categorization for Lightspeed, Palo Alto and FortiGuard, not client-installed blocker detection; no replacement added.
- https://www.cisco.com/c/en/us/support/docs/security/umbrella/224734-verify-umbrella-is-configured-correctly.html describes vendor-specific DNS configuration tests. These are useful diagnostics, not a universal cross-origin browser detection API. Server-side checks would test the VPS rather than the user's Chromebook and are not used as device evidence.

The browser UI preserves Unknown/multiple results and offers manual selection. No user account/profile data is collected by detection.

## Expanded historical signature coverage

- Securly
- GoGuardian
- LanSchool
- Linewize
- Blocksi
- FortiGuard
- Cisco Umbrella
- ContentKeeper
- Hapara
- iboss
- Lightspeed
- InterCLASS
- InterSafe
- LoiLo Web Filters
- IMTLazarus
- Impero
- Mobile Guardian

These are 17 product families, including classroom management products; a match does not prove network filtering is enabled. Runtime checks read no file contents and never execute the vendor code. Current managed-device coverage remains unverified.

## Chromebook follow-up (2026-09-17)

- The original probe depended only on historical filenames and cached its first result for the entire page lifetime. The detector now also checks known extension IDs with resource paths actually exposed in the page, allows three seconds for slow managed devices, and expires cached scans after 30 seconds. A superseded scan cannot overwrite a newer result.
- The current Securly ID is recognized only when it exposes a resource path in the DOM; no private paths are guessed or executed. Hidden and dynamic extension resources still cannot be enumerated by websites. No managed Chromebook is available here, so this improves known failure cases without claiming universal detection.
- Chrome documents these restrictions at https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources . Manual selection remains available, and connection failover does not depend on identifying the filter.

## Unknown result follow-up (2026-09-17, local)

- User confirmed the Chromebook scan finishes with Unknown, not a frozen button. Live response headers do not impose a connect-src policy that blocks the probes.
- Rechecked HughParry/chrome-extension-identifier and Chrome's web-accessible-resource documentation. No verified broader school-filter replacement was found; arbitrary page keywords would give false positives. Public Chrome update requests for the current Securly, GoGuardian and Lightspeed IDs returned 404. No installed-device success is claimed.
- Added explicit address-based identification for the known extension IDs (including current Securly), GoGuardian/Securly vendor domains, and Cisco block.opendns.com. Users paste their block-page address and explicitly choose Use this filter. This identifies the supplied address's vendor; it does not claim automatic installed-filter detection.
- URL matching uses the hostname, never query/path keywords or embedded target URLs. Raw addresses are not requested, sent or saved; the input clears after applying the vendor. Unknown results expose this fallback, and manual vendor choice persists independently of later automatic scans.
- Sources: https://github.com/HughParry/chrome-extension-identifier ; https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources ; https://support.securly.com/hc/en-us/articles/360001053407-Filter-How-does-Securly-s-extension-work ; https://www.cisco.com/c/en/us/support/docs/security/umbrella/224740-use-umbrella-block-page-diagnostic-info.html .
