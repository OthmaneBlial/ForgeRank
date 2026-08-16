# ForgeRank roadmap

This roadmap is ordered by dependency and outcome, not artificial dates.

## Foundation — operational vertical slice

Acceptance: migrations, conservative public-document adapter, safe Git adapter, snapshots, provenance, queue/worker, versioned scoring/ranking, real seed identifiers, core UI, tests, and Docker/CI exist. Status: **in progress**; the main path, cadence-driven scheduler, database-backed worker health, fail-closed operator access, standalone deployment bundle, and production PostgreSQL adapter are exercised locally, while the complete Docker stack and long-run operation still need proof.

## Repository intelligence

Acceptance: bounded Git enrichment, activity/history charts, contributor concentration, technology and quality detectors, score explanations, aliases, stale/error states, and ranking history work across representative repositories. Status: **implemented for available evidence**; the complete shareable repository-leaderboard filter/sort contract, server-side pagination, exact coverage denominators, completed-run global rank history, windowed rank movement, deterministic human-readable project signals, versioned retained-evidence project timelines, bounded README structural analysis, technology ecosystems, and safe quota-driven cache eviction now complement repository-level evidence. Naturally accumulated long-run activity history and broader stale/error proof remain.

## Discovery and ecosystems

Acceptance: defensible trending modes, Hidden Gems, revival detection, language/topic aggregates, curated collections, similarity, and daily/weekly reports are snapshot-backed. Status: **implemented for available evidence**; eight explicit tested discovery modes now include retained-score Most Improved and neutrally worded Cooling Giants, while Git analysis v2 persists bounded prior quiet intervals so Revived classification can actually occur after sustained renewed activity. Hidden Gems, deterministic topics, versioned similarity across language, topics, technologies, bounded description keywords, curated collections, and lifecycle, versioned language-ecosystem history, and coverage-bounded daily/weekly reports also work. Results remain visibly withheld until naturally accumulated windows satisfy their gates.

## Developer intelligence

Acceptance: public profile parser fixtures, confirmed-profile boundary, portfolio and collaboration aggregates, contribution timelines, transparent developer score v1, and removal/correction operations exist. Status: **implemented for legitimately linked evidence**; confirmed profiles, explicit non-fork portfolios, project-level activity/collaboration, evidence timelines, nine distinct evidence-gated leaderboard modes with shareable filters, versioned scores, and auditable hide/restore/correct/revert controls work. Independently evidenced Git-author/account links and dependable account-age evidence remain future coverage rather than inferred data.

## Comparison and signature views

Acceptance: two-to-five repository comparison, shareable routes, saved comparisons, ecosystem comparison, accessible Momentum Matrix, and normalized project battles all use comparable windows. Status: **implemented for currently available evidence**; the signature matrix now combines shareable language/topic/age/star filters, logarithmic observed popularity, fixed-scale momentum, snapshot-window growth/span disclosure, and explicit denominators. Repository comparison growth is withheld until every project has enough observations in a shared window, while ecosystem aggregates expose indexed, scored, and Git-analyzed denominators instead of implying global coverage.

## Product polish and distribution

Acceptance: PWA install/offline behavior, dynamic OG cards, cached SVG badges, full sitemap, local favorites, WCAG AA audit, keyboard flows, mobile layouts, and measured performance budgets pass. Status: **implemented with lab evidence**; distribution surfaces, fully keyboard-operated fuzzy search, streamed route skeletons, layered error recovery, truthful 404 semantics, desktop/mobile WCAG automation, inspected responsive artifacts, and eight deterministic standalone-production performance profiles pass across the homepage, filtered repository leaderboard, discovery modes, and repository detail. Real-device assistive-technology review and production field telemetry remain deployment follow-up rather than fabricated evidence.

## Hardening and public milestone

Acceptance: parser circuit behavior, crawl-budget persistence, cache eviction/disk quotas, PostgreSQL integration tests, worker recovery, data exports, deployment smoke, accessibility/performance audits, and the complete Definition of Done in the project goal are proven. Status: **partially implemented**; shared policy persistence, stale-lock recovery, database-backed worker heartbeats, explicit web readiness, safe cache quotas, deterministic background snapshot downsampling, persistent intake limits, priority refresh scheduling, public data health, protected operations telemetry, privacy-safe repository exports with versioned timeline events, an isolated network-free E2E/performance fixture, a clean production dependency audit, a real PostgreSQL integration audit, an unprivileged split container design, and a CI deployment smoke now exist, while an actual Docker-run result remains.
