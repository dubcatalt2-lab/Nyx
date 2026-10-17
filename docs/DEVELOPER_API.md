# Nyx API

The public `/api` page and existing Apps → Nyx API Keys entry use OpenRouter through the Nyx server. The owner's actual OpenRouter key never leaves the VPS. Old Groq-era keys cannot authenticate to the new gateway.

Verified Nyx email accounts receive a one-time 1,000-token Gemini 2.5 Flash Lite grant. One active key per account; users on the same network have independent keys and grants. Rotation does not refill the balance. Premium instead shares a 50,000-token UTC calendar-month allowance with shared Nyx chat, across Gemini and Luna; Gemini can continue after the allowance is spent, while Luna stops. The configured owner has no personal token/daily-message ceiling. All requests still obey site spending and burst/concurrency protections.

The public workspace has API Keys, Playground, Usage and owner-only dashboard tabs. Playground uses a pasted/generated Nyx key with the same backend limits, shows response token counts, and supports cancellation. Keys remain in page memory only. Usage shows lifetime token totals, requests today, the remaining balance meter and the latest 20 request outcomes. No paid background warmups run.

Keys are returned once and stored only as SHA-256 digests. Users can revoke their key. Account deletion/restriction, disabled status, email verification removal and revocation are checked before paid requests. API tokens are lifetime balances, and daily/minute limits reset separately. Defaults: 20 requests/day, 4/minute, 512 maximum output tokens. Requests default to 256 output tokens and shrink to available balance. Text only, non-streaming, at most 24 messages / 32 KB. Actual confirmed provider token usage settles conservative reservations; ambiguous failures retain them. A global 120-second request deadline bounds gateway work.

The gateway uses the same $1 daily spending partitions, concurrency limits, model price caps and $0.10 OpenRouter balance cutoff as Nyx AI. The existing site eligibility cutoff and 5–10 chat-message policy apply to the chat UI; verified API accounts have separate request counters and their owner-configured limits. Site-wide throttles may be stricter than a key's own limit. Raising a key's token balance does not raise the dollar budget.

## Owner controls

Owner Dashboard → Manage AI API keys and token balances opens `/api#owner`. Only the configured founder administrator UID can unlock, not an arbitrary account with an Owner role. The extra password cannot grant ownership. The session lasts 15 minutes, uses an HttpOnly/Secure/SameSite cookie, and still requires the Firebase owner token on every operation. Five password attempts per 15 minutes are enforced in Firestore. Password changes invalidate existing sessions after the service reloads.

Use the paginated active-key member list or load a Nyx user ID. Change the Premium monthly ceiling (without resetting usage), add regular-account tokens, choose Gemini and/or Luna, set output/daily/minute limits, or revoke their key. No automatic verification override: regular users must verify their own email. Signup stays email-optional; verification is required only for the developer API. On the public page, Send verification email uses Firebase and does not change normal signup.

## Set the separate password after deploying these files

In the SSH terminal connected to your VPS:

```sh
cd /var/www/nyx
sudo python3 scripts/set-api-owner-password.py
sudo systemctl restart nyx
```

The script prompts twice; typing or pasting shows nothing. Choose a unique password of at least 16 characters. It stores only a salted scrypt hash in `/etc/nyx/nyx.env`, preserving other settings and file permissions. Do not paste passwords or OpenRouter keys into chat. Run the same script to change the password.

Sign in to your Nyx owner account, open `https://nyxlearning.org/api#owner`, and enter that password. For a normal user, open `/api`, verify email, refresh access, then create a key and copy it once.

## Call the API

```sh
curl https://nyxlearning.org/api/v1/ai \
  -H "Authorization: Bearer YOUR_NYX_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"google/gemini-2.5-flash-lite","messages":[{"role":"user","content":"Hello"}],"max_tokens":128}'
```

POST accepts OpenAI-style messages; response contains choices and usage. Put issued keys on your application's server. Streaming, images, tools and arbitrary provider parameters are currently rejected. All developer-account, key and password-attempt records live in the server-only `nyxDeveloperApi` Firestore collection.

Nyx AI also accepts Nyx and OpenRouter keys through Custom key. Keys stay in page memory, never in saved preferences or exports. OpenRouter calls go directly to its fixed API endpoint; Nyx keys use the same guarded gateway.
