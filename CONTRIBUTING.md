# Contributing

1. Open an issue for substantial acquisition, scoring, schema, or policy changes.
2. Install with `pnpm install`, migrate with `pnpm db:migrate`, and load identifiers with `pnpm seed`.
3. Keep domain logic pure and infrastructure behind application services.
4. Add fixtures and tests for parser or detector changes. Normal tests must not contact GitHub.
5. Run `pnpm verify`, `pnpm test:e2e`, and the relevant measured audit. UI changes should normally include `pnpm audit:accessibility`; initial-load or data-density changes should include `pnpm audit:performance`; schema, queue, or persistence changes should include `pnpm audit:postgres` against a clean database.

Do not add token configuration, authenticated GitHub paths, hidden endpoints, external AI requirements, contact-data harvesting, fake production metrics, or scoring constants inside React components.

Parser changes should include a sanitized fixture, an explicit parser-version decision, failure-mode consideration, and evidence that missing optional fields remain tolerated.
