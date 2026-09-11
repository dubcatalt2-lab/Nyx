# Shared AI allowances

Local implementation, not deployed. Shared AI now requires a signed-in account. Email is optional and signup no longer sends a verification message or opens the email-verification gate. Cloud preferences and game saves still require authenticated ownership, but no longer require `emailVerified`. Password reset and the actual email-verification status remain unchanged.

## Default request protection

Firestore transactions in the server-only `nyxAiAllowance` collection enforce allowances across app processes, restarts, API keys and Nyx aliases using the same Firebase project. Client writes to this collection are denied by the existing catch-all rule. Nothing stores prompts, responses, provider keys or raw network addresses in this collection.

| Setting | Default |
| --- | --- |
| Shared requests per UTC day | 1,000 |
| New-account / established / owner pools | 20% / 70% / 10% |
| Requests per account per day | 5 standard; up to 10 with token headroom |
| Requests per account per minute | 4 |
| Requests per shared network per minute | 120 |
| Simultaneous requests | 1/account, 3/site |
| New-account simultaneous requests | 1 at the default site capacity |
| Capacity reserved for owner | 1 of the default 3 slots |
| New-account requests per browser per day | 30 across accounts |
| Account creation through Nyx | 3 attempts/browser/day; 100/network/hour |
| Maximum output | 700 tokens new; 2,200 otherwise |

The new-account pool releases capacity throughout the day, with a burst allowance equal to three hours of replenishment. Exhausting that pool does not borrow from the other pools. Failed/invalid requests that have passed authentication can still consume request allowance; retry loops do not reset it. All paid subrequests, including corrupted-response retries and server-side image analysis, must reserve separately; at most four paid calls can occur in one request. A shared request has a two-minute abort deadline; abandoned concurrency leases expire after three minutes.

Accounts enter the established pool after at least seven days of account age **and** successful AI use on three distinct days in the last 30 days. Server-authorized Premium accounts and explicitly approved accounts also enter this pool. Account age alone is insufficient. In the Owner Dashboard's user detail, the owner can approve, restrict or restore automatic AI access. These actions are audited and protected by server-side owner permissions. Approval changes the budget pool only; it does not bypass the join-date/Premium eligibility rule. Personal provider options have been retired.

## Optional dollar limits and OpenRouter

The user selected OpenRouter and initially selected $1/day, then asked what that amount meant. The explanation was that this is a total site usage ceiling, not a subscription or a per-user charge. **No live amount or provider was changed. The dollar setting remains pending confirmation.**

For an approved $1/day configuration, set the following in the protected VPS environment file. Never put the actual key in Git or frontend code:

```dotenv
NYX_OPENROUTER_API_KEY=<server-only-key>
NYX_OPENROUTER_MANAGEMENT_KEY=<server-only-management-key-from-the-same-account>
NYX_AI_DAILY_BUDGET_USD=1
NYX_AI_MONTHLY_BUDGET_USD=30
NYX_AI_MODEL_PRICES_JSON={"shared:google/gemini-2.5-flash-lite":{"inputPerMillion":0.1,"outputPerMillion":0.4,"requestUsd":0,"maxInputTokens":32768}}
```

This sample uses the public OpenRouter catalog's DeepSeek V4 Flash rates observed September 10, 2026. Recheck before activation. These are USD per **million** tokens; the catalog reports per-token prices. The dedicated OpenRouter key selects its official chat/model endpoints and takes precedence over the legacy shared credential and endpoint. Removing it restores the legacy selection; it is not an automatic failure fallback.

Only explicitly priced models appear in the shared OpenRouter picker. Nyx sends server-controlled OpenRouter `provider.max_price` limits and requires parameter support; a price increase can therefore make a model unavailable rather than authorizing a higher price. Extra server-paid providers, including the Nyx-issued Groq API-key gateway, also require their own `provider-id:model-id` entries when dollar accounting is enabled. Ordinary external personal keys do not spend the shared budget; any paid server image analysis they request does.

### Ten-cent remaining-balance cutoff

Before each shared OpenRouter inference call, including retries and owner requests, Nyx reads the account's remaining credits (`total_credits - total_usage`) and the inference key's remaining allowance. At $0.10 or below it returns HTTP 503 with **“AI is unavailable at this moment. Try again later.”** It also refuses a request above that balance if its estimated cost plus recent reservations would reach the ten-cent floor. Personal provider credentials and other providers' balances are unaffected.

The account credit endpoint requires a separate **management key**, stored only as `NYX_OPENROUTER_MANAGEMENT_KEY` on the server. It must belong to the same account as the inference key. The management credential is used only for the credits request; the inference key is used for its own allowance lookup and model calls. Missing keys, malformed balances, timeouts or failed checks all pause paid requests with the same public message. No provider response, account balance or credential is exposed in that error. Dollar reservations for calls blocked before sending are refunded; request counts remain consumed.

The balance check is fresh for each call, with a five-second deadline. An additional Firestore `openrouter-balance` ledger atomically holds recent cost estimates across all models and processes for five minutes, including completed/cancelled calls, to cover simultaneous requests and billing delay. This can pause AI conservatively above ten cents. A successful fresh check after a refill resumes access once the other allowances permit it; no restart or manual unpause is necessary. This is still not a guarantee against delayed provider billing beyond that window, charges from other applications, or inaccurate model cost estimates. Keep provider-side limits and auto-top-up off.

Reference: [OpenRouter account credits endpoint and management-key requirement](https://openrouter.ai/docs/api/api-reference/credits/get-remaining-credits), [current key allowance](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key).

With a $1 limit, the daily pools are $0.20 new, $0.70 established and $0.10 owner. Each new account also has a $0.02 daily ceiling; each established/owner account has $0.10. The monthly ceiling applies across all pools. New-account dollar reservations are paced too. The owner reserve is currently owner-only; approving a member assigns the established allowance rather than handing out the reserve.

Before sending a paid request, Nyx atomically reserves an upper estimate based on UTF-8 input bytes, framing overhead, capped output, and configured per-request/image pricing. Completed responses with usage metadata reconcile the reservation; missing usage, interrupted streams, provider errors and lost settlements retain the estimate. Provider-reported cost above the estimate is recorded and reduces subsequent availability. Request counters and money reservations are distinct: a refund does not restore message count or burst capacity.

**Shared OpenRouter paid calls fail closed unless a positive dollar budget and model prices are configured.** Invalid configuration/storage failures do not permit unmetered calls. A price map is a configured bound, not a live billing guarantee: tokenization, provider accounting and additional charges can differ. Keep a provider-side spending limit, prepaid balance without auto-reload, and billing monitoring as additional protection. Nyx's ledger does not include credit-purchase fees, VPS or Firestore charges, or spending outside Nyx.

Official references: [OpenRouter model catalog](https://openrouter.ai/api/v1/models), [usage accounting](https://openrouter.ai/docs/cookbook/administration/usage-accounting), [provider price limits](https://openrouter.ai/docs/guides/routing/provider-selection).

## Limits and operations

- Device cookies are random, signed, first-party, HttpOnly, SameSite=Lax and Secure over HTTPS. Clearing cookies or switching unrelated domains changes the device signal; UID/network/pool limits still apply. Hashes obscure network values in this ledger but are not anonymization.
- Shared-school IPs are aggregate signals, not identities. A determined attacker with different devices, IPs or compromised trusted accounts can still consume an allowance. This reduces damage and isolates capacity; it does not eliminate abuse.
- Limits on account creation cover Nyx's signup route, not direct calls to Firebase's public signup API. Keep Firebase/edge protections in place. CAPTCHA/Turnstile and recovery codes are not added by this change.
- Counters reset in fixed documents and arrays are bounded. Unique device/network/signup documents can accumulate; no automated retention policy is installed. If adding TTL, retain account history/counters for at least 31 days and exclude `global` and `device-secret` documents. Do not delete/reset the global ledger to recover capacity: that permits additional spending within the same period.
- A single Firestore global document serializes budget decisions. Validate contention and Firestore cost under production load before scaling significantly. Do not point separate Nyx backends at separate Firebase projects and expect a shared limit.
- Settings: `NYX_AI_DAILY_REQUEST_BUDGET`, `NYX_AI_NEW_DAILY_REQUESTS`, `NYX_AI_ESTABLISHED_DAILY_REQUESTS`, `NYX_AI_ACCOUNT_REQUESTS_PER_MINUTE`, `NYX_AI_NETWORK_REQUESTS_PER_MINUTE`, `NYX_AI_CONCURRENT_GLOBAL`, `NYX_AI_TRUSTED_UIDS`, plus the monetary variables above. Retired provider credentials are not read.

## Verification

`npm run test:ai-allowance` runs isolated transactional and HTTP middleware tests without paid API calls or live Firebase writes. `node scripts/test-account-signup.mjs` exercises desktop/mobile signup and unverified cloud sync with Firebase fixtures. These do not establish live OpenRouter key validity, production Firestore contention, or provider billing behavior. Full deployment validation also requires `npm run build:netlify` and `npm run check:deploy`.

## Provider retirement (2026-09-10)

OpenRouter is the only supported shared provider. Old shared, Groq, Navy, Hugging Face and personal-provider options and credential fallbacks are removed. The browser ignores previously saved personal-provider credentials. Code Sandbox uses the same OpenRouter catalog. The old `/api/v1/ai` gateway returns 410; existing Nyx key records remain available for listing and revocation, but no longer authorize inference. Image context uses local analysis, not a separate paid vision provider. OpenRouter requires both server-side keys, a positive configured dollar budget and priced models before paid calls can start.

## Owner balance warning

The owner dashboard checks `/api/owner-dashboard/ai-status` on load/refresh and every minute while visible. Only the owner role can access balances. It warns when either account credits or the key allowance is below $0.50 and marks the $0.10 cutoff separately. Failed checks show an unknown state, not a stale healthy balance. Administrative reads share a 30-second cache; inference checks remain fresh. The daily site cap is displayed separately and does not represent the prepaid balance.

The user confirmed $1/day and installed both keys on OVH. The environment now contains that daily cap and a Luna-only priced model configuration, pending application deployment. Read-only authentication/balance verification succeeded; no paid inference was used. `node scripts/test-owner-ai-status.mjs` verifies owner authorization, desktop/phone layout, warning/cutoff/failure/refill behavior and non-owner isolation; set NYX_TEST_ASSET_ROOT=dist to check the production build.

## Eligibility and five-message allowance (2026-09-10)

Shared AI is restricted to accounts whose Firebase Auth creation time is strictly before August 25, 2026 at midnight America/Los_Angeles (2026-08-25T07:00:00Z), or with a server-authorized active Premium entitlement. Existing subscription semantics include trialing. Missing/invalid creation times fail closed for non-Premium accounts. Owner status, manual AI approval, edited profile dates and browser headers do not override eligibility; account bans/restrictions still apply. This policy currently covers shared AI in both Nyx AI and Code Sandbox, across all allowed models.

Each account has five standard requests per UTC day, subject to existing rate, output and dollar limits. Requests 6?10 are permitted only when total daily input/output token usage, including the next request's conservative input and maximum-output reservation, stays at or below 10,000 tokens. The first five requests can exceed that token total if the other limits permit them; in that case no bonus requests are available. The hard ten-message ceiling applies to Premium and Owner too, and cannot be raised by old per-tier environment values. Lower configured tier limits still apply. Unknown/interrupted provider usage retains reserved tokens, retries count toward the same token total, and unsent balance-denied calls refund their token reservation. Accepted request attempts can still consume the message counter when a later validation/provider step fails. Token/message counters reset at 00:00 UTC; money/usage settlements remain idempotent and respect rollover.

`node scripts/test-ai-access-policy.mjs` covers the exact cutoff boundary, invalid dates, Premium/restriction changes, trust/role bypass attempts, five expensive/ten cheap messages, conservative bonus admission, missing usage, refunds and reset. The HTTP integration test verifies that actual Firebase creation time is used and ineligible users never reach inference.

## Direct image requests

Shared chat now sends image pixels to a model whose OpenRouter input modalities include images. Gemini 2.5 Flash Lite and GPT-5.6 Luna both support images. Images are decoded and normalized on the server before sending, and each Gemini or Luna image reserves at least 8,192 input tokens in addition to textual context and maximum output. All message/eligibility/dollar/balance checks still apply. Invalid or unsupported images are rejected; no caption-only downgrade is used. This supersedes the earlier shared local-analysis description. Unknown billed usage still retains estimates. Screenshot text may remain unreadable if the source is too small; a closer crop may be needed. `node scripts/test-ai-images.mjs` checks actual payload pixels and billing reservations without a paid model request.

## Current model configuration: Gemini and Luna

The user clarified that only DeepSeek is replaced: Gemini 2.5 Flash Lite and GPT-5.6 Luna remain available together. The private VPS allowlist contains exactly these two models. Gemini uses $0.10/million input and $0.40/million output bounds; Luna uses $0.25/million input (including cache-write headroom) and $1.20/million output. Both have a 32,768 estimated input-token ceiling and conservative 8,192-token image reservation. They share existing keys, eligibility, message quotas, the $1/day site cap and balance warnings. Catalog tests prove DeepSeek is excluded while both image-capable models are exposed.

No new key is required. PDF upload support has not been implemented. A later user-authorized one-image comparison passed all three checks on both Gemini and Luna. Gemini took 1.24s ($0.0002005 reported), Luna 0.95s ($0.00032045 reported) after removing its unsupported temperature parameter. This single simple image is not a general quality/latency benchmark. App changes remain local, not pushed/deployed.
