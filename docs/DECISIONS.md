# Architecture decisions

## ADR-001 — PostgreSQL semantics locally and in production

Use Drizzle's PostgreSQL schema with PGlite for zero-service local development and postgres.js in production. This avoids maintaining divergent SQLite/PostgreSQL migrations while keeping first-run setup lightweight.

## ADR-002 — Public documents and Git are separate adapters

HTML metadata observation and Git engineering analysis have different policies, costs, confidence, and failure modes. They remain separate infrastructure services and converge only in normalized evidence.

## ADR-003 — Server-rendered observatory UI

Use Next.js server components for data surfaces, minimal client islands for command search, theme, local watchlists, compare builder, and submission. Heavy charts are code-native SVG and can be lazy-loaded as the product grows.

## ADR-004 — Editorial industrial visual language

ForgeRank uses Newsreader, IBM Plex Sans/Mono, graphite/paper themes, forge-orange signal accents, square analytical surfaces, and restrained motion. The intended memory is an open-source observatory, not a generic gradient SaaS dashboard.

## ADR-005 — Missing data is a first-class state

Null means unavailable. History-dependent views require observations and confidence. Production UI never ships a mock metric or fills a gap with an average.

## ADR-006 — Safe transfers become aliases

At most two HTTPS same-host repository redirects can produce a canonical transfer. ForgeRank merges collection membership, removes the duplicate discovered identity, persists the old canonical key as an alias, and resolves old detail URLs to the canonical entity.
