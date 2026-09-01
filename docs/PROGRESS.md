# Product status

Last reviewed: 2026-09-01

ForgeRank is an **alpha, local-first repository intelligence application**. The product surface is broad and the evidence rules are deliberately conservative, but the current index is a bounded local cohort—not a mirror of GitHub and not a global ranking.

This page records durable capabilities and open evidence gaps. It intentionally avoids completion percentages and static test counts, which become misleading as the suite evolves.

## Ready to explore

- Repository rankings with explicit cohort, score version, observation time, confidence, and one persisted reason per score dimension.
- Trending, Rising, Breakout, Most Improved, Hidden Gems, Established, Most Active, and Cooling Giants views backed by retained observations rather than popularity fallbacks.
- Repository details with bounded Git activity, lifecycle, technologies, project structures, README structure, score explanations, ranking history, project events, and privacy-safe exports.
- Developer views restricted to confirmed public profiles and explicitly owned non-fork repositories. Git authors are never silently relabeled as GitHub accounts.
- Repository, developer, language, technology, topic, collection, comparison, report, Momentum Matrix, search, watchlist, badge, sitemap, and PWA surfaces.
- Versioned PostgreSQL persistence, queueing, scheduling, shared request budgets, parser circuits, worker health, retention, operator controls, and local data exports.
- A network-free sample profile with four fictional repositories in a dedicated PGlite directory. Run it with `pnpm demo`.
- A public `forgerank` npm package exposing the operations CLI and worker. Version `0.1.0` was verified from a clean registry install through migrations and seed loading.

## Evidence boundaries

- Seeds contain identifiers, not analytics. A fresh real index starts with missing evidence and fills only from successful observations.
- Rankings describe the repositories observed by ForgeRank at one calculation time. They do not describe every GitHub repository.
- Snapshot-backed growth and rank movement stay unavailable until a comparable baseline exists.
- Git enrichment is shallow, blobless, depth-limited, time-bounded, and does not download Git LFS objects.
- Public-page collection is robots-aware, cached, budgeted, and fail-closed. This is an operational safeguard, not a claim of GitHub approval or a blanket right to collect public information.
- Avoiding REST/GraphQL credentials does not remove network limits or make coverage complete.

## Current coverage gaps

- The default local dataset has not naturally accumulated dependable 7/30/90-day history. Momentum-heavy views therefore remain limited until enough real observations exist.
- Developer ingestion works for legitimately confirmed profiles, but independently evidenced Git-author/account links and dependable account-age evidence remain sparse.
- Broader long-running operation, parser drift against future public-page changes, and real-device assistive-technology review require ongoing observation.
- The split unprivileged container design and PostgreSQL audit exist, but an actual Docker Compose run is still an explicit release proof rather than an assumed result.
- GitHub Actions is intentionally paused during the current product rework. Local verification remains authoritative until the workflow is restored.
- No reusable software license has been selected. The source is publicly readable and the npm package is marked `UNLICENSED`, but reuse rights should not be assumed until the repository owner adds a license.

## Verification contract

The main local gate is:

```bash
pnpm verify
```

Changes should also run the relevant measured audit:

```bash
pnpm test:e2e
pnpm audit:accessibility
pnpm audit:performance
pnpm audit:postgres
pnpm audit:docker
```

The deterministic browser and performance fixtures use isolated data and do not contact GitHub. See [Performance](../PERFORMANCE.md), [Data sources](../DATA_SOURCES.md), [Privacy](../PRIVACY.md), and the [roadmap](ROADMAP.md) for the detailed contract.
