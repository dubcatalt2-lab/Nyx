# MizuMath ↔ Nyx global chat

This is a server-to-server integration. MizuMath keeps its accounts and UI. Its
server authenticates each user, loads their public profile, and signs requests to
Nyx. Never accept a sender ID or profile from an unauthenticated browser request.
Never put the shared secret in browser JavaScript, an iframe URL, or a public repo.

Base URL: `https://nyxlearning.org/api/integrations/mizu/v1`

The Nyx operator and MizuMath owner must exchange a random 32-byte-or-longer secret
privately. Store it as `NYX_MIZU_CHAT_SECRET` on Nyx and `MIZU_NYX_SECRET` on
MizuMath. Until configured, the integration rejects requests. Rotate both copies
together. This does not enable chat on the separate AWS backend.

## Signing (Node.js, server only)

```js
import { createHmac, randomUUID } from 'node:crypto';

async function nyx(method, path, body = {}) {
  const timestamp = String(Date.now());
  const serialized = JSON.stringify(body);
  const signature = createHmac('sha256', process.env.MIZU_NYX_SECRET)
    .update([timestamp, method, path, serialized].join('\n')).digest('hex');
  const response = await fetch('https://nyxlearning.org' + path, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-mizu-timestamp': timestamp,
      'x-mizu-signature': signature,
    },
    ...(method === 'GET' ? {} : { body: serialized }),
  });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error), { status: response.status });
  return result;
}
// Inside your authenticated backend handler: derive currentUser from the session.
// Keep messageId stable across retries; do not create a new ID for each retry.
const messageId = randomUUID();
await nyx('POST', '/api/integrations/mizu/v1/messages', {
  messageId, text: 'Hello!',
  user: {
    id: currentUser.id, displayName: currentUser.displayName,
    avatarUrl: currentUser.avatarUrl, bannerUrl: currentUser.bannerUrl,
    bio: currentUser.bio,
  },
});
```

Sign the exact path including the query string. GET signs `{}`. Timestamps are
milliseconds, accepted within 60 seconds; keep server clocks synchronized.
TLS is required. Identical message IDs from the same user are deduplicated.

## Endpoints

| Method/path | Purpose |
| --- | --- |
| `POST /messages` | Send text (1–1,000 characters) with stable `messageId` and `user`. |
| `PUT /profile` | Sync `{user}` when a public profile changes, without sending a message. |
| `GET /messages` | Latest 100 global messages, oldest first; includes Nyx and MizuMath messages. |
| `GET /messages?before=<milliseconds>` | Older history; use `nextBefore` from the preceding page. |
| `GET /users/<external-id>/status` | Returns the Nyx UID and current `banned` flag. |

Poll messages from **one MizuMath backend worker**, every 2–5 seconds; cache the
result and distribute it to your clients. Deduplicate by Nyx message `id`, replace
edited records, and reconcile the latest window to remove deleted messages.
This version has no partner WebSocket or webhook. Older history is paginated.
Do not embed access to private channels, direct messages, or voice; this API only
shares the public global channel (`general` internally).

External user IDs are immutable strings of 1–100 letters, numbers, `_` or `-`.
Nyx assigns a collision-resistant `mizu_...` UID. Public profiles contain display
name, avatar, bio and banner. Nyx shows a Mizu label; incoming roles, permissions,
premium claims, effects and decorations are ignored. Profile images must use
HTTPS; supply URLs you control and are entitled to share. Render message text and
profile fields as text, never raw HTML. No emails, passwords, IPs or private account
fields belong in this payload.

## Bans and errors

Nyx moderators right-click a MizuMath message to **Ban from shared global chat**
or **Unban from shared global chat**. Nyx enforces the ban in the message write
transaction, even if MizuMath has not refreshed its UI. MizuMath should disable
sending when status says banned, and always handle HTTP 403 from sends.
Profile updates, reconnecting, and changing display names cannot remove a ban.
A newly created MizuMath account is a new identity; the MizuMath owner remains
responsible for account verification and ban-evasion controls on that site.

401 means bad/expired signature; 403 means a ban or locked/unavailable channel;
429 means slow down (one message per second, at most 20 per minute per user).
503 means the integration is unconfigured or temporarily unavailable. Retry with
backoff and the same message ID; never retry 403 as if it were a connection error.

Do not forward Nyx history back into the send endpoint: display it. Doing so would
create message loops. A shared secret authorizes MizuMath's backend, not end users.
