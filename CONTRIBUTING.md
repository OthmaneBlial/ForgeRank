# Contributing to ForgeRank

ForgeRank welcomes focused bug reports, fixture improvements, accessibility fixes, documentation corrections, and evidence-backed product changes. The project values one rule above all: uncertainty must remain visible.

## Before opening a pull request

- Search existing issues and describe the user-visible problem or evidence gap.
- Open an issue first for acquisition, scoring, schema, privacy, identity, or policy changes. These decisions affect the product's trust boundary.
- Keep a pull request narrow enough to review and explain how you verified it.
- Note that a reusable software license has not yet been selected. If that affects your planned contribution, discuss it in the issue before doing substantial work.

## Local setup

Use Node.js 22 or newer and Corepack-managed pnpm:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm demo
```

`pnpm demo` creates a dedicated `data/demo-pglite` database containing four fictional repositories and synthetic history. It does not collect from GitHub or touch the normal local database.

For a real empty index:

```bash
pnpm db:migrate
pnpm seed
pnpm dev
```

Seeds contain identifiers only. Missing observations after startup are expected.

## Project boundaries

Do not add:

- GitHub REST/GraphQL API calls, tokens, OAuth, authenticated scraping, or hidden endpoints;
- contact-data harvesting or inferred links between Git authors and public accounts;
- external AI requirements, generated production metrics, or synthetic data presented as real;
- scoring constants inside React components;
- collection that bypasses robots decisions, request budgets, cache rules, or fail-closed behavior.

Keep domain logic pure and infrastructure behind application services. Parser or detector changes should include a sanitized fixture, an explicit versioning decision, failure-mode coverage, and proof that missing optional fields remain tolerated.

## Verification

Every change should pass the main local gate:

```bash
pnpm verify
```

Run the additional gate that matches the risk:

| Change                                  | Additional verification                             |
| --------------------------------------- | --------------------------------------------------- |
| User interface, routing, or interaction | `pnpm test:e2e` and `pnpm audit:accessibility`      |
| Initial load or data-dense view         | `pnpm audit:performance`                            |
| Schema, queue, worker, or persistence   | `pnpm audit:postgres` against a disposable database |
| Container or deployment packaging       | `pnpm audit:docker`                                 |
| Public-page or Git acquisition          | fixture tests plus `pnpm verify:zero-api`           |

Normal unit and browser fixtures must not contact GitHub. Include screenshots for material visual changes and state the viewport used.

GitHub Actions is temporarily paused during the current product rework, so the contributor and reviewer must treat these local results as the canonical evidence.

## Reporting a data or scoring issue

Include the repository identifier, page or command, observation time, visible confidence/freshness state, expected behavior, and a minimal redacted reproduction. Do not post tokens, credentials, private repository data, email addresses, or full local databases.

Thanks for helping ForgeRank make rankings easier to inspect—and easier to challenge constructively.
