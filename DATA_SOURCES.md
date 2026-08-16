# Data sources

## Allowed sources

- Public GitHub HTML documents when their robots policy permits automated access.
- Public Git repositories over normal HTTPS Git transport.
- Public repository files read through a bounded partial clone.
- ForgeRank's own historical observations and derived aggregates.
- Version-controlled repository identifiers and curated collections.
- Explicitly documented open datasets if a future change records a redistribution-compatible license.

## Prohibited sources

ForgeRank has no runtime path for the GitHub API, GraphQL, tokens, OAuth, authenticated sessions, hidden JSON endpoints, IP rotation, bot-protection evasion, fake accounts, commercial data APIs, or external AI/embedding services.

## Public HTML acquisition

The fetcher identifies ForgeRank through a configurable public contact URL. It checks robots policy, honors caches and conditional requests, enforces a five-megabyte document cap, follows at most two safe same-host redirects to the same document kind, uses bounded retries, respects retry-after, and records status, duration, hash, parser, and timestamp. Host circuits plus hourly and daily request budgets are stored in PostgreSQL so all workers share the same limit across restarts.

Selectors live in `src/infrastructure/github-public/selectors.ts`. Sanitized fixtures prevent ordinary tests from generating public traffic.

## Git inspection

The Git inspector uses shallow, single-branch, blobless bare clones and incremental fetches. Repository trees are capped at 30,000 paths per analysis. Manifest reads are allowlisted and capped at 512 KiB. Contributor metrics use sanitized Git author display names and irreversible local keys; commit emails are neither stored for display nor surfaced.

## Provenance and confidence

Every repository snapshot records parser and score versions plus field-level source metadata. The latest scored snapshot also stores one structured reason per score dimension, including its evidence status and the observed values used in the explanation. Legacy snapshots are not assigned explanations from newer observations. Language-ecosystem snapshots record their calculation version, indexed/scored/Git-analyzed denominators, and observation time. Repository timeline events are versioned derivations over retained snapshots, completed ranking runs, and bounded Git analyses; no external event time is reconstructed. Confidence is HIGH, MEDIUM, LOW, or INSUFFICIENT. Missing evidence remains null and receives an explicit insufficient-data state in the UI.

Snapshots are appended at collection/calculation time. Low-priority maintenance may downsample redundant old observations only after 90 days: daily representatives are retained through one year and weekly representatives thereafter. Recent evidence is never downsampled, and maintenance is not part of public request handling.
