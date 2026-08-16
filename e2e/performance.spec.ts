import { expect, test, type Page } from "@playwright/test";

type LabMetrics = {
  timeToFirstByteMs: number;
  largestContentfulPaintMs: number;
  cumulativeLayoutShift: number;
  domContentLoadedMs: number;
  loadMs: number;
  javascriptTransferBytes: number;
  javascriptDecodedBytes: number;
  domNodes: number;
  longTaskTotalMs: number;
};

const budgets: LabMetrics = {
  timeToFirstByteMs: 1_000,
  largestContentfulPaintMs: 2_500,
  cumulativeLayoutShift: 0.1,
  domContentLoadedMs: 2_500,
  loadMs: 3_000,
  javascriptTransferBytes: 350_000,
  javascriptDecodedBytes: 1_200_000,
  domNodes: 2_000,
  longTaskTotalMs: 500,
};

const routes = [
  { name: "homepage", path: "/", readyText: /Discover what matters/i },
  {
    name: "repository leaderboard",
    path: "/repositories?sort=growth&period=30d&language=TypeScript&stars=1k-5k&age=1-3&status=active",
    readyText: "Repository rankings",
  },
  {
    name: "discovery modes",
    path: "/trending?mode=cooling&period=7",
    readyText: "Open-source momentum",
  },
  { name: "repository detail", path: "/r/sharkdp/bat", readyText: "bat" },
] as const;

async function observeVitals(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const metrics = { largestContentfulPaintMs: 0, cumulativeLayoutShift: 0, longTaskTotalMs: 0 };
    Object.defineProperty(window, "__forgerankLabMetrics", { value: metrics, writable: false });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) metrics.largestContentfulPaintMs = entry.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
        if (!shift.hadRecentInput) metrics.cumulativeLayoutShift += shift.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) metrics.longTaskTotalMs += entry.duration;
    }).observe({ type: "longtask", buffered: true });
  });
}

async function readMetrics(page: Page): Promise<LabMetrics> {
  return page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const scripts = resources.filter(
      (resource) =>
        resource.initiatorType === "script" || resource.name.includes("/_next/static/chunks/"),
    );
    const vitals = (
      window as typeof window & {
        __forgerankLabMetrics: {
          largestContentfulPaintMs: number;
          cumulativeLayoutShift: number;
          longTaskTotalMs: number;
        };
      }
    ).__forgerankLabMetrics;
    return {
      timeToFirstByteMs: navigation.responseStart - navigation.startTime,
      largestContentfulPaintMs: vitals.largestContentfulPaintMs,
      cumulativeLayoutShift: vitals.cumulativeLayoutShift,
      domContentLoadedMs: navigation.domContentLoadedEventEnd - navigation.startTime,
      loadMs: navigation.loadEventEnd - navigation.startTime,
      javascriptTransferBytes: scripts.reduce((sum, resource) => sum + resource.transferSize, 0),
      javascriptDecodedBytes: scripts.reduce((sum, resource) => sum + resource.decodedBodySize, 0),
      domNodes: document.querySelectorAll("*").length,
      longTaskTotalMs: vitals.longTaskTotalMs,
    };
  });
}

for (const route of routes) {
  test(`${route.name} stays inside production lab budgets`, async ({ page }, testInfo) => {
    await observeVitals(page);
    await page.goto(route.path, { waitUntil: "load" });
    await expect(
      page.getByRole("heading", {
        name: route.readyText,
        exact: route.name === "repository detail",
      }),
    ).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await page
      .locator("body")
      .evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
      );
    const metrics = await readMetrics(page);
    await testInfo.attach("production-lab-metrics", {
      body: JSON.stringify(
        { route: route.path, project: testInfo.project.name, metrics, budgets },
        null,
        2,
      ),
      contentType: "application/json",
    });
    process.stdout.write(
      `[performance:${testInfo.project.name}:${route.path}] ${JSON.stringify(metrics)}\n`,
    );

    for (const [metric, budget] of Object.entries(budgets) as Array<[keyof LabMetrics, number]>) {
      expect(
        metrics[metric],
        `${metric}: ${metrics[metric]} exceeds ${budget}`,
      ).toBeLessThanOrEqual(budget);
    }
    expect(metrics.largestContentfulPaintMs, "LCP observer did not record a value").toBeGreaterThan(
      0,
    );
  });
}
