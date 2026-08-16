# Security policy

Report security issues privately through the repository's configured security advisory channel. Do not include live credentials or private personal data in an issue.

ForgeRank treats repository URLs, public HTML, Git objects, manifests, filenames, and generated output as untrusted. The implementation uses a host allowlist, strict URL parsing, argument-array Git invocation, timeouts, document and manifest size limits, bounded tree traversal, local cache paths derived from validated segments, HTML parsing without execution, and no rendered raw repository HTML.

The Git cache enforces `GIT_CACHE_MAX_GB`, evicts only validated inactive bare-repository directories, protects the repository currently being inspected, and refuses paths outside its exact cache layout. Operators should still apply an outer filesystem quota, keep PostgreSQL private, set a real `FORGERANK_CONTACT_URL`, and terminate TLS at a trusted proxy.

The `/admin/*` boundary fails closed. It is hidden unless either the development-only loopback flag is active outside production or production operator access is explicitly enabled with a username and a password of at least 20 characters. Production access is challenged with HTTP Basic authentication, checked both before routing and beside the protected data read, and marked private/no-store/noindex. Credentials must come from the deployment secret store, must never be committed, and are safe in transit only over HTTPS. Keep the dashboard on a private network or add an upstream IP allowlist where possible, and ensure the proxy forwards `Authorization` without logging it.

Never paste or commit credentials. ForgeRank should not need GitHub credentials at all.
