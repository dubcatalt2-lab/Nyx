Direct S3 hosting

The entry can use https://s3.amazonaws.com/BUCKET/studies.html.
It redirects to https://BUCKET.s3.REGION.amazonaws.com before account code runs.
The shared path-style origin must never hold app authentication or user storage.
No CloudFront is required. This is a static frontend; the existing Nyx backend
must stay online for authentication, AI, chat, uploads and relay services.

Build the maintained source with:
  node "scripts/ms. bird's study binder DO NOT Touch.mjs" --once
  npm run check:deploy
  node scripts/build-direct-s3-export.mjs --origin=https://BUCKET.s3.REGION.amazonaws.com --backend=https://nyxlearning.org

Use a dedicated empty bucket in the matching region. Before publishing, add
ONLY its exact canonical origin to NYX_STATIC_ORIGINS on the backend and its
hostname to Firebase Authentication authorized domains. Preserve existing
origins, authorized domains and private configuration. Never allow the shared
https://s3.amazonaws.com origin. Restart through the established release process.

Authenticate AWS CLI locally. Set AWS_PROFILE and AWS_DEFAULT_REGION, then run
node upload.mjs from the generated package. The uploader refuses nonempty
buckets or existing bucket policies. It grants anonymous GetObject only and
leaves ACL blocking enabled. It never changes account-wide access settings.
Only upload generated public site files; never credentials or diagnostic bundles.

Tests:
  node scripts/test-direct-s3.mjs
  NYX_TEST_STATIC_ROOT=dist node scripts/test-direct-s3.mjs
Use PowerShell $env:NAME='value' syntax on Windows.
The test creates temporary certificates with OpenSSL (Git for Windows path by
default; override NYX_TEST_OPENSSL). Playwright Chromium must be installed.
For an actual exported fixture, build with https://nyx-fixture.s3.amazonaws.com
and set NYX_TEST_EXPORT_ROOT to its output directory. Never publish that fixture.
Tests cover isolated-origin startup, streamed API responses, authentication
headers, partitioned cookies, Socket.IO polling/WebSockets and HTTP relay batches.
They do not certify live account login, providers, microphones or every game.

The current public entry is recorded in the deployment handoff, not hardcoded
in source. S3 does not run the backend or replace backend hosting charges.
