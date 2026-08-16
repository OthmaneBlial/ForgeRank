import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const routes = [
  { name: "homepage", path: "/", heading: /Discover what matters/i },
  {
    name: "not found recovery",
    path: "/outside-the-forgerank-index",
    heading: "That path is outside the index",
  },
  { name: "repository leaderboard", path: "/repositories", heading: /Repository rankings/i },
  { name: "repository detail", path: "/r/sharkdp/bat", heading: "bat" },
  { name: "coverage", path: "/coverage", heading: "Know the denominator" },
  { name: "methodology", path: "/methodology", heading: "Every rank needs a reason" },
  {
    name: "discovery modes",
    path: "/trending?mode=cooling&period=7",
    heading: "Open-source momentum",
  },
  {
    name: "momentum matrix",
    path: "/insights",
    heading: "Popularity is only one axis",
  },
  {
    name: "ecosystem comparison",
    path: "/compare/ecosystems/typescript,rust",
    heading: "TypeScript vs Rust",
  },
  { name: "developer detail", path: "/d/sharkdp", heading: "David Peter" },
  {
    name: "developer leaderboard",
    path: "/developers?category=collaboration",
    heading: "Developer impact, with boundaries",
  },
  { name: "daily report", path: "/daily", heading: "Fastest rising" },
  { name: "weekly report", path: "/weekly", heading: "The week in open source" },
] as const;

async function expectNoWcagViolations(page: Page): Promise<void> {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const summary = result.violations.flatMap((violation) =>
    violation.nodes.map((node) => ({
      rule: violation.id,
      target: node.target.join(" "),
      failure: node.failureSummary,
    })),
  );
  expect(result.violations.length, JSON.stringify(summary, null, 2)).toBe(0);
}

async function expectLightAndDarkWcagCompliance(page: Page): Promise<void> {
  await expectNoWcagViolations(page);
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expectNoWcagViolations(page);
}

for (const route of routes) {
  test(`${route.name} has no automated WCAG A/AA violations`, async ({ page }) => {
    await page.goto(route.path);
    await expect(
      page.getByRole("heading", { name: route.heading, exact: route.name === "repository detail" }),
    ).toBeVisible();
    await expectLightAndDarkWcagCompliance(page);
  });
}

test("command palette has no automated WCAG A/AA violations", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: /Search the index/i });
  await expect(trigger).toHaveAttribute("data-interactive-ready", "true");
  await trigger.click();
  await expect(page.getByRole("dialog", { name: "Search ForgeRank" })).toBeVisible();
  await expectLightAndDarkWcagCompliance(page);
});

test("skip link reaches main content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Skip to content" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

test("command palette traps focus and restores its trigger", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: /Search the index/i });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Search ForgeRank" });
  const input = dialog.getByRole("combobox", { name: "Search query" });
  await expect(input).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("reduced-motion preference disables decorative motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const animationDuration = await page
    .locator(".orbit-a")
    .evaluate((element) => getComputedStyle(element).animationDuration);
  expect(["0.01ms", "1e-05s"]).toContain(animationDuration);
});
