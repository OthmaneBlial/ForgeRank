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
| Desktop home                | 32 ms | 148 ms | 0.0060 |  92 ms | 122 ms |   159.0 KiB |  558.9 KiB |       714 |       0 ms |
| Desktop repository rankings | 35 ms | 524 ms | 0.0008 |  82 ms | 111 ms |   159.2 KiB |  560.0 KiB |       421 |       0 ms |
| Desktop discovery modes     | 17 ms | 148 ms | 0.0415 |  69 ms | 101 ms |   157.9 KiB |  558.2 KiB |       183 |       0 ms |
| Desktop repository detail   | 50 ms | 184 ms | 0.0008 | 108 ms | 170 ms |   159.6 KiB |  561.3 KiB |       693 |      77 ms |
| Mobile home                 | 24 ms | 136 ms | 0.0000 |  71 ms | 129 ms |   159.0 KiB |  558.9 KiB |       714 |       0 ms |
| Mobile repository rankings  | 18 ms | 388 ms | 0.0000 |  60 ms | 107 ms |   157.9 KiB |  558.2 KiB |       420 |       0 ms |
| Mobile discovery modes      | 15 ms |  84 ms | 0.0000 |  54 ms |  85 ms |   157.9 KiB |  558.2 KiB |       183 |       0 ms |
| Mobile repository detail    | 29 ms | 436 ms | 0.0000 |  76 ms | 128 ms |   159.6 KiB |  561.3 KiB |       693 |      71 ms |

These values establish a local regression baseline only. They should not be presented as production-user Core Web Vitals until field telemetry exists.
