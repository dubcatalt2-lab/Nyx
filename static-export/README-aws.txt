Nyx connected S3 package

This is the complete locally hosted frontend, not an iframe launcher. The site/ directory comes from the production obfuscation build. Existing opaque URLs, identifier mappings, games, backgrounds and app assets are retained. No server credentials or YouTube cookies are included.

AUTOMATIC AWS SETUP
1. Install Node.js 20+ and AWS CLI v2. Sign in to your own AWS account using AWS CLI/SSO.
2. Use an S3 bucket you control. Choose a new, unused folder name in that bucket.
3. Extract this ZIP. In its directory run:
   node upload.mjs YOUR-BUCKET nyx nyx-static
4. Wait for CloudFormation to finish. Use the printed HTTPS CloudFront URL.

No site address needs to be edited. The app derives its address at runtime. The installer detects the bucket region, uploads site/ to the chosen folder, creates CloudFront and read-only origin access, merges one scoped read grant into the existing bucket policy, and prints the address. Files outside that folder are not deleted. Existing same-name files inside it are updated. AWS storage, requests and CloudFront usage can incur charges.

CloudFront serves the frontend from your S3 bucket and forwards API, media, chat and relay requests to the existing Nyx VPS over HTTPS. API responses are not cached. Authorization, cookies, range requests and query parameters are forwarded. A request function checks the viewer's origin before adapting it for the backend. Normal sign-in, roles, limits and provider availability still apply; this does not grant owner or paid access.

Plain https://BUCKET.s3.REGION.amazonaws.com/... links serve objects only. They cannot provide the required backend routing; use the generated CloudFront address. Merely uploading site/ is insufficient for AI/music/NyxTube. S3 website endpoints are HTTP-only, which also prevents secure worker browsing. No external AWS or VPS configuration has been changed to prepare this archive.

The backend must remain online. The newly added device-ban backend requires a separate Nyx backend deployment before its command works. This export does not deploy server code. Provider playback can still fail due to expired sessions, upstream verification or provider outages. Each hostname has its own browser storage/sign-in; OAuth providers may require adding a custom hostname to Firebase's authorized domains. No authenticated AWS production playback has been certified before installation.

The setup creates a new CloudFormation stack/distribution; do not reuse an unrelated stack name. Re-run the same command to upload an update. Deleting the stack does not delete your existing bucket/files; remove its scoped bucket-policy grant separately if retiring it.

Source and corresponding build scripts: https://github.com/dubcatalt2-lab/Nyx
Retain THIRD_PARTY_NOTICES.md and shipped license files when distributing.
AWS reference: https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-origin-request-policies.html
