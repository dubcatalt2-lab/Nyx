# Tutsi filter detection comparison

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
