# ForgeRank architecture

## Boundaries

```text
src/app + src/components          Presentation
src/application                   Use cases and read models
src/domain                        Pure policy, scores, trends, classification
src/infrastructure                PostgreSQL, public documents, Git, queue, logs
src/worker                        Long-running job orchestration
```

Dependencies flow inward. UI code consumes application read models. It does not parse HTML, run Git, or calculate rankings. Infrastructure implements public-source and persistence concerns around pure domain rules.

## Data flow

1. Version-controlled identifiers or validated user submissions create canonical repository records.
2. A deduplicated job enters PostgreSQL with priority, availability, attempts, and a bounded retry policy.
3. The worker checks source policy and cache before requesting a public HTML document.
4. A versioned parser validates structure and normalizes only observed fields.
5. The snapshot transaction updates the current read projection and appends immutable historical evidence with field-level provenance.
6. Bounded Git inspection enriches activity, Git-author, technology, and quality signals without exposing author email addresses.
7. Versioned domain services compute confidence-adjusted scores, one structured evidence reason per score dimension, and lifecycle state.
8. A separate job persists ranking snapshots; requests only read precomputed projections.

## Historical lifecycle

Repository, developer, ranking, and language-ecosystem observations are append-only at ingestion time. Ranking runs persist current language cohort counts, observed stars, score/momentum averages, and Git-analysis coverage so ecosystem movement can emerge from ForgeRank's own history rather than reconstruction.

Repository recalculation persists its six structured reasons in both the current read projection and the latest snapshot. Historical snapshots created before reason persistence remain explicitly unexplained; ForgeRank does not backfill them from newer evidence.

Long-history maintenance runs as low-priority background work and is available as a dry-run-first operator command. It retains every observation for 90 days, the newest observation per UTC day through one year, and the newest observation per UTC week thereafter. Downsampling is entity-scoped, deterministic, tested, and never executes during a page request.

## Local and production database

The schema is PostgreSQL. Local development uses PGlite, an embedded PostgreSQL build, so migrations and SQL semantics stay close to production. `DATABASE_URL` switches the adapter to normal PostgreSQL. Next.js keeps PGlite external to its server bundle to preserve its filesystem/WASM runtime.

## Failure behavior

- Unavailable robots policy fails closed.
- 403/429 and retry-after responses pause rather than trigger evasion.
- Five consecutive host failures open a 15-minute database-backed circuit shared across processes.
- Hourly and daily request budgets are persisted as bounded request events, so restarts cannot reset them.
- Parser mismatches do not persist malformed values.
- Existing cached observations remain readable when acquisition fails.
- Counter decreases are anomaly flags, not published negative growth.
- Queue jobs are retryable, observable, and claimed with row locking; stale worker locks are requeued or failed after their attempt budget is exhausted.
- Web liveness is process-only; web readiness performs a bounded database probe. Workers write a heartbeat every 20 seconds, and deployment health treats missing, stopping, or older-than-policy heartbeats as unavailable.

## Security boundary

Only `https://github.com/{owner}/{repo}` roots pass repository validation. Usernames, credentials, ports, extra path segments, null bytes, and option-like segments are rejected. Git is always invoked with an executable plus an argument array; no user-controlled shell string exists.

The operator dashboard has a separate, fail-closed boundary. Next.js Proxy applies the initial `/admin/*` check and the server page repeats authorization immediately before protected database reads. A development bypass accepts exact loopback hosts only outside production. Production access requires an explicit enable flag and environment-injected HTTP Basic credentials; missing or short credentials cannot accidentally expose the route. Responses are non-cacheable and excluded from indexing.
