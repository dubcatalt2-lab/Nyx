# Search loading repair - October 12, 2026

The live trace reproduced a long wait for DuckDuckGo's render-blocking scripts and styles. Initial HTML completed about 1.2 seconds after submission, but the largest script completed at 11.1 seconds. A second fresh Chrome trace recorded first contentful paint at 11,696 ms. Both traces reached the provider's human-verification screen, not verified search results.

## Comparison with the older implementation

Inspection of commit `85cf438` shows an explicit workspace warm-up path, parallel worker/transport initialization, a retained engine instance, and a compiled rewriting engine. The current replacement instead performs JavaScript syntax-tree processing, including server-side processing on initial document loads. This is a code comparison, not a controlled timing benchmark of the old deployed release. None of the removed libraries or their sources were restored.

## Changes

- Index syntax nodes and scopes once, then process the indexed nodes. Remove two redundant recursive traversals while preserving complete scope indexing before reference handling.
- Reuse identical script and CSS transformation output with an exact source comparison and a key containing the URL base, routing prefix, language and parsing context. Changed source/context cannot reuse an older result.
- Bound retained text to 32 MiB and 64 entries per runtime with a five-minute lifetime. Compilation failures are not retained.
- Continue fetching upstream responses and applying their current cookies and headers. Do not cache HTML, login responses, account results, or HTTP failures. Cache only the pure text transformation; session-specific HTML injection stays outside it.
- Start the browser's worker-message queue immediately after installing the runtime listener. Otherwise parser-blocking scripts/styles wait for authorization messages that the browser queues until DOMContentLoaded, producing a five-second timeout and partial, unstyled pages. The reproduction delayed runtime delivery by 700 ms and failed with two authorization timeouts before the fix; it loads the stylesheet and script after the fix. No polling, longer timeout, or authentication bypass was added. This follows the browser's documented [message queue behavior](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/startMessages).

## Verification

- Twelve captured DuckDuckGo scripts/styles produced byte-for-byte identical output before and after the traversal change. In the paired local run, the 1,001,940-character script changed from 413 ms to 173 ms; the 1,412,794-character script changed from 452 ms to 299 ms. Immediate identical compilations rounded to 0 ms. These are processing timings, not total page-load promises.
- Twenty network/unit tests passed, including exact cache keys, source invalidation, expiry, eviction, parse-mode separation, and session-specific HTML preservation.
- Browser regressions passed: static HTML, CSS, dynamic requests, 40 concurrent resources, redirects, cookie persistence, workers, event streams, and Images/Videos/All filter navigation.
- Chrome and Edge tests through the actual nested shell passed origin isolation, cookie-write recovery, worker authorization, clicked login windows/callbacks, unsolicited-window denial and forged-host rejection.

Raw local logs are retained under `.codex-artifacts/search-*.log`; no browser session data is committed.

## Live result and release status

The final live Chrome test through localhost:8080 recorded first contentful paint at 5,544 ms on the first load after the document service restarted and 2,632 ms on the repeat load in the same browser context, compared with 11,696 ms in the earlier trace. Provider responses and cache state vary: these observations are not a controlled benchmark or a guarantee. The final trace no longer contains the script authorization 502 seen before the fix. Cold loading still takes several seconds.

DuckDuckGo presented its human-verification page. These measurements verify styled page rendering, not successful search results beyond that challenge. Separate fixture tests cover filter navigation. The unrelated AI catalog 503, upstream analytics 410 and analytics requests aborted by navigation remain visible; this is not a claim of a completely error-free live session.

Runtime changes are committed in `e6c48ad5` and `fd5bfc03`, pushed to public main and the release branch, and activated in the separate HTTPS document service. Its preceding connection directory is retained for rollback. The main application's existing static production release remains unchanged; its Git source is updated. Localhost:8080 serves the newly rebuilt distribution and uses the updated document service. No removed engine was restored.

Final build output:

```text
PASS retired-engine audit: 5220 files, 661 decoded payloads, 2327 media/archive files classified separately, 0 prohibited matches
```

```json
{
  "passed": true,
  "files": 5220,
  "counts": { "atob": 0, "eval": 2, "Function": 2 },
  "nonGlobalFunctionMethods": 4,
  "rawMatches": 452,
  "classified": 452,
  "blockingFindings": 0,
  "pathMatches": 0,
  "parseErrors": 0,
  "unreadable": 0,
  "sourceMaps": 0,
  "embeddedPrograms": 1
}
```

Full raw output, including the local report path, is in `.codex-artifacts/search-final-build.log`. Final live traces are in `search-final-live.log`; Chrome/Edge startup regression output is in `search-deadlock-chrome.log` and `search-deadlock-edge.log`. `npm run check:deploy` also passes.
