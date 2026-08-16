# Performance budgets

ForgeRank measures representative pages from the optimized production server, not from the development compiler. Run:

```bash
pnpm audit:performance
```

The Playwright report attaches the complete metric object for each route and viewport. These are reproducible local lab measurements, not field Core Web Vitals; production Real User Monitoring remains necessary after deployment.

## Initial lab budgets

| Metric                      |     Budget | Why                                                                     |
| --------------------------- | ---------: | ----------------------------------------------------------------------- |
| Time to first byte          | ≤ 1,000 ms | Keeps server-rendered routes responsive while leaving local/CI variance |
| Largest Contentful Paint    | ≤ 2,500 ms | Core Web Vitals “good” threshold                                        |
| Cumulative Layout Shift     |     ≤ 0.10 | Core Web Vitals “good” threshold                                        |
| DOM content loaded          | ≤ 2,500 ms | Guards critical document readiness                                      |
| Window load                 | ≤ 3,000 ms | Guards full initial resource completion                                 |
| Initial JavaScript transfer |   ≤ 350 KB | Prevents unnecessary client payload growth                              |
| Initial JavaScript decoded  |   ≤ 1.2 MB | Guards parse/compile pressure independently of compression              |
| DOM nodes                   |    ≤ 2,000 | Prevents unbounded initial markup                                       |
| Long-task total             |   ≤ 500 ms | Guards obvious main-thread blocking in the initial load                 |

The current audit rebuilds the same isolated network-free evidence fixture used by E2E, then covers the homepage, a populated and evidence-filtered repository leaderboard, the Cooling Giants discovery mode, and a populated repository detail route at desktop and mobile viewport sizes. Service workers are blocked so an existing local cache cannot hide payload regressions. Leaderboards are server-paginated, score calculations are persisted, and historical read models use bounded indexed queries and retained snapshots.

## Verified baseline

Measured 2026-08-16 with local headless Chromium against the copied `next build` standalone deployment bundle, without network or CPU throttling:

| View                        |  TTFB |    LCP |    CLS |    DCL |   Load | JS transfer | JS decoded | DOM nodes | Long tasks |
| --------------------------- | ----: | -----: | -----: | -----: | -----: | ----------: | ---------: | --------: | ---------: |
| Desktop home                | 32 ms | 148 ms | 0.0060 |  93 ms | 122 ms |   159.2 KiB |  560.3 KiB |       714 |       0 ms |
| Desktop repository rankings | 35 ms | 452 ms | 0.0008 |  88 ms | 139 ms |   159.4 KiB |  561.4 KiB |       421 |       0 ms |
| Desktop discovery modes     | 19 ms | 156 ms | 0.0415 |  75 ms | 107 ms |   158.1 KiB |  559.5 KiB |       183 |       0 ms |
| Desktop repository detail   | 56 ms | 208 ms | 0.0008 | 118 ms | 161 ms |   159.8 KiB |  562.6 KiB |       725 |      83 ms |
| Mobile home                 | 24 ms | 144 ms | 0.0000 |  73 ms | 103 ms |   159.2 KiB |  560.3 KiB |       714 |       0 ms |
| Mobile repository rankings  | 20 ms | 380 ms | 0.0000 |  69 ms | 120 ms |   158.1 KiB |  559.5 KiB |       420 |       0 ms |
| Mobile discovery modes      | 17 ms |  92 ms | 0.0000 |  61 ms |  93 ms |   158.1 KiB |  559.5 KiB |       183 |       0 ms |
| Mobile repository detail    | 31 ms |  96 ms | 0.0000 |  79 ms | 129 ms |   159.8 KiB |  562.6 KiB |       725 |      70 ms |

These values establish a local regression baseline only. They should not be presented as production-user Core Web Vitals until field telemetry exists.
