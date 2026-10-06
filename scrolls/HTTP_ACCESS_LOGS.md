# HTTP access logs

Enabled on OVH on September 9, 2026, with Caddy reloaded and the Nyx process unchanged.

- File: `/var/log/caddy/nyx-access.json` on the VPS. It is not served by Nyx.
- Directory: `caddy:caddy`, mode `0750`; file mode `0640`.
- JSON records include timestamp, requested hostname, sanitized path, method, status, response size, duration, client connection information, and origin/referrer hostnames when supplied.
- Request headers and response headers are omitted. Query strings are removed. Origin/referrer fields retain only hostnames, excluding credentials, paths and queries. Encoded proxy destinations and tab IDs under `/service/`, `/~/sj/` and `/~/sj-v1/` are reduced to the route prefix. Request bodies are not logged by this configuration.
- Rolls at 20 MiB or after 24 hours on the next write. Up to seven compressed archives are retained, with a seven-day archive age limit. This is roughly 160 MiB before compression for seven full archives plus the active file, not a filesystem quota.
- Applies to the apex, custom HTTPS hosts and the HTTP redirect site. Requests handled entirely by an upstream cache do not reach Caddy. WebSocket access records may appear only after the connection closes.
- Origin/referrer values are client-supplied evidence, not authenticated site identities. Logs cannot reconstruct requests made before logging was enabled. The Railway Wisp is a separate service and is not included.

Read recent records from PowerShell:

```powershell
ssh ubuntu@15.204.93.166 "sudo tail -n 50 /var/log/caddy/nyx-access.json"
```

The shared `nyx_access_log` snippet lives in `deploy/caddy/nyx.Caddyfile.template`. Setup/update scripts create the private log directory. The logging-only change was applied directly to `/etc/caddy/Caddyfile` and the three matching deployment source files on the VPS; the user subsequently authorized committing and deploying these changes with the Nyxify reliability audit. Preserve this logging configuration on later releases.

Validation: isolated Caddy requests with synthetic authorization/cookie/API-key/query/referrer secrets verified omission; proxy routes verified destination removal. Public apex/www/custom-domain probes returned 200 and appeared in the live log with secrets omitted. Caddy validated successfully, both services stayed active, and Nyx retained PID 521197. A pre-change configuration is retained at `/etc/caddy/Caddyfile.before-access-20260909`; validate and reload any rollback rather than restarting the application.

Changing options for an already-open log file may require a new filename or Caddy restart to take effect; see the [Caddy logging documentation](https://caddyserver.com/docs/caddyfile/directives/log#file).
