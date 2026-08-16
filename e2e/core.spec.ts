import { expect, test } from "@playwright/test";

test("liveness and readiness endpoints are explicit and non-cacheable", async ({ request }) => {
  const live = await request.get("/api/health/live");
  expect(live.status()).toBe(200);
  expect(await live.json()).toEqual({ status: "ok" });
  expect(live.headers()["cache-control"]).toContain("no-store");

  const ready = await request.get("/api/health/ready");
  expect(ready.status()).toBe(200);
  expect(await ready.json()).toEqual({ status: "ready", database: "reachable" });
  expect(ready.headers()["cache-control"]).toContain("no-store");
});

test("home is a real product surface with transparent coverage", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Discover what matters/i })).toBeVisible();
  await expect(page.getByText("GitHub API usage")).toBeVisible();
  await expect(page.getByText("Zero", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Methodology/i }).first()).toBeVisible();
});

test("unknown routes return a truthful recoverable 404", async ({ page }) => {
  const response = await page.goto("/outside-the-forgerank-index");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "That path is outside the index" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Return home" })).toBeVisible();
  await expect(page.getByText(/No replacement record has been guessed/i)).toBeVisible();
});

test("momentum matrix combines shareable filters with bounded observed evidence", async ({
  page,
}) => {
  await page.goto("/insights");
  await page.getByLabel("Language").selectOption("TypeScript");
  await page.getByLabel("Topic").selectOption("frontend");
  await page.getByLabel("Repository age").selectOption("1-3");
  await page.getByLabel("Minimum observed stars").fill("900");
  await page.getByRole("button", { name: "Apply" }).click();

  await expect(page).toHaveURL(/language=TypeScript/);
  await expect(page).toHaveURL(/topic=frontend/);
  await expect(page).toHaveURL(/age=1-3/);
  await expect(page).toHaveURL(/stars=900/);
  await expect(page.getByLabel("Momentum Matrix coverage")).toContainText("Plotted3");
  await expect(page.getByRole("group", { name: "Repository momentum matrix" })).toBeVisible();
  await expect(page.locator(".matrix-point-list > a")).toHaveCount(3);
  await expect(page.getByText("facebook/react", { exact: true })).toBeVisible();
  await expect(page.getByText("sveltejs/svelte", { exact: true })).toBeVisible();
  await expect(page.getByText("solidjs/solid", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Plotted repository evidence")).toContainText("30d growth");
  await expect(page.getByLabel("Plotted repository evidence")).toContainText("ForgeRank");
  await expect(page.getByLabel("Plotted repository evidence")).toContainText("Momentum");
  await expect(page.getByText(/without interpolation/i)).toBeVisible();
});

test("coverage publishes lightweight freshness and index health", async ({ page }) => {
  await page.goto("/coverage");
  await expect(page.getByRole("heading", { name: "Know the denominator" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Freshness without internal exposure" }),
  ).toBeVisible();
  await expect(page.getByText("Repository snapshots")).toBeVisible();
  await expect(page.getByText("Refreshed / 24h")).toBeVisible();
  await expect(page.getByText("Refresh due")).toBeVisible();
  await expect(page.getByText("Git-analyzed repositories")).toBeVisible();
  await expect(page.getByText(/Missing windows stay unavailable/i)).toBeVisible();
});

test("global command search is keyboard accessible", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('[data-interactive-ready="true"]')).toBeVisible();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
  const dialog = page.getByRole("dialog", { name: "Search ForgeRank" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("combobox", { name: "Search query" }).fill("sharkdp/bat");
  await expect(dialog.getByText("sharkdp/bat", { exact: true })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/r\/sharkdp\/bat/);
});

test("global search tolerates small spelling mistakes", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('[data-interactive-ready="true"]')).toBeVisible();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
  const dialog = page.getByRole("dialog", { name: "Search ForgeRank" });
  await dialog.getByRole("combobox", { name: "Search query" }).fill("typescrpt");
  await expect(dialog.getByText("TypeScript", { exact: true }).first()).toBeVisible();
});

test("repository leaderboard composes evidence filters in shareable URLs", async ({ page }) => {
  await page.goto("/repositories");
  await page.getByLabel("Ranking").selectOption("growth");
  await page.getByLabel("Growth period").selectOption("30d");
  await page.getByLabel("Language").selectOption("TypeScript");
  await page.getByLabel("Observed stars", { exact: true }).selectOption("1k-5k");
  await page.getByLabel("Repository age").selectOption("1-3");
  await page.getByLabel("Lifecycle").selectOption("active");
  await expect(page.getByLabel("Include observed forks")).not.toBeChecked();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/sort=growth/);
  await expect(page).toHaveURL(/period=30d/);
  await expect(page).toHaveURL(/language=TypeScript/);
  await expect(page).toHaveURL(/stars=1k-5k/);
  await expect(page).toHaveURL(/age=1-3/);
  await expect(page).toHaveURL(/status=active/);
  await expect(page.getByLabel("Repository leaderboard coverage")).toContainText(
    "Filtered cohort2",
  );
  await expect(page.getByLabel("Repository leaderboard coverage")).toContainText("30d growth2 / 2");
  await expect(page.locator(".repository-table tbody tr")).toHaveCount(2);
  await expect(page.locator(".repo-card-evidence")).toHaveCount(2);
  await expect(page.getByText(/Git authors are not inferred accounts/i)).toBeVisible();

  if ((page.viewportSize()?.width ?? 0) > 820) {
    await page.getByRole("link", { name: "Observed reach" }).click();
  } else {
    await page.getByLabel("Ranking").selectOption("stars");
    await page.getByRole("button", { name: "Apply" }).click();
  }
  await expect(page).toHaveURL(/sort=stars/);
  await expect(page).toHaveURL(/period=30d/);
});

test("trend modes use shareable, distinct signal definitions", async ({ page }) => {
  await page.goto("/trending?mode=active&period=7");
  await expect(page.getByRole("link", { name: "Most active" })).toHaveClass(/active/);
  await expect(page.locator(".signal-evidence-grid")).toBeVisible();
  await page.getByRole("link", { name: "Breakout" }).click();
  await expect(page).toHaveURL(/mode=breakout/);
  await expect(page.getByText(/Breakout is not defensible yet|signal/).first()).toBeVisible();
  await page.getByRole("link", { name: "Most improved" }).click();
  await expect(page).toHaveURL(/mode=improved/);
  await page.getByRole("link", { name: "Cooling giants" }).click();
  await expect(page).toHaveURL(/mode=cooling/);
});

test("seeded repository detail never invents missing analytics", async ({ page }) => {
  await page.goto("/r/vuejs/core");
  await expect(page.getByRole("heading", { name: "core", exact: true })).toBeVisible();
  await expect(
    page.getByText(/Insufficient history|Not scored|Awaiting first observation/).first(),
  ).toBeVisible();
  await expect(page.getByText(/Git authors, not inferred accounts/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Request refresh" })).toBeVisible();
  await page.getByRole("button", { name: "Request refresh" }).click();
  await expect(page.getByRole("status")).toContainText(
    /Refresh requested|already queued|recent refresh request/,
  );
});

test("repository score exposes persisted dimension-level reasons", async ({ page }) => {
  await page.goto("/r/sharkdp/bat");
  await expect(page.getByRole("heading", { name: "Observed reasons" })).toBeVisible();
  await expect(page.locator(".score-reason")).toHaveCount(6);
  await expect(page.locator(".score-reason").filter({ hasText: "Impact" })).toContainText(
    /stars|Impact evidence is unavailable/,
  );
  await expect(page.locator(".score-reason").filter({ hasText: "Trust" })).toContainText(
    /confidence|Additional observations are required/,
  );
  await expect(page.getByText("These are calculation inputs, not verdicts.")).toBeVisible();
});

test("repository signals remain deterministic and evidence bounded", async ({ page }) => {
  await page.goto("/r/sharkdp/bat");
  await expect(page.getByRole("heading", { name: "ForgeRank signals" })).toBeVisible();
  await expect(page.locator(".project-signal")).toHaveCount(6);
  await expect(page.getByText("Maintained", { exact: true })).toBeVisible();
  await expect(page.getByText("Distributed authorship", { exact: true })).toBeVisible();
  await expect(
    page.locator(".project-signal").filter({ hasText: "Observed momentum" }),
  ).toContainText(/not code quality/i);
  await expect(page.getByText(/Missing evidence produces no signal/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Documentation signals" })).toBeVisible();
  const readme = page.locator(".readme-analysis-panel");
  await expect(readme).toContainText("README.md");
  await expect(readme).toContainText("Installation section: detected");
  await expect(readme).toContainText("not a documentation-quality score");
  const structures = page.locator(".quality-panel");
  await expect(page.getByRole("heading", { name: "Observed repository structures" })).toBeVisible();
  await expect(structures).toContainText("Release automation detected");
  await expect(structures).toContainText("Dependency management detected");
  await expect(structures).toContainText("Dedicated documentation detected");
  await expect(structures).toContainText("repository-quality-signals-v2");
  await expect(page.locator(".technology-panel")).toContainText("technology-detection-v2");
});

test("repository rank history uses completed snapshot windows", async ({ page }) => {
  await page.goto("/r/sharkdp/bat");
  await expect(page.getByRole("heading", { name: "Global rank history" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Global rank history" })).toBeVisible();
  const windows = page.getByLabel("Ranking movement windows");
  await expect(windows).toContainText("24H");
  await expect(windows).toContainText("7D");
  await expect(windows).toContainText("30D");
  await expect(page.getByText(/among 4 repositories currently indexed and scored/i)).toBeVisible();
  await expect(page.getByText(/missing runs are never interpolated/i)).toBeVisible();
});

test("repository timeline exposes only derived retained-evidence events", async ({
  page,
  request,
}) => {
  await page.goto("/r/sharkdp/bat");
  await expect(page.getByRole("heading", { name: "Project timeline" })).toBeVisible();
  const timeline = page.getByRole("list", { name: "Derived repository event timeline" });
  await expect(timeline.getByText("1k observed-star milestone", { exact: true })).toBeVisible();
  await expect(timeline.getByText("3 new Git tags observed", { exact: true })).toBeVisible();
  await expect(timeline.getByText("Sustained activity resumed", { exact: true })).toBeVisible();
  await expect(timeline.getByText("ForgeRank tracking began", { exact: true })).toBeVisible();
  await expect(timeline).toContainText("Tags are not automatically labeled releases");
  await expect(
    page.getByText(/Exact external milestone times are not interpolated/i),
  ).toBeVisible();

  const response = await request.get("/api/export/repository/sharkdp/bat");
  expect(response.status()).toBe(200);
  const exported = (await response.json()) as {
    schemaVersion: string;
    gitAnalysis: {
      readmeAnalysis: { version: string; sectionCount: number };
      technologyDetectionVersion: string;
      qualitySignalsVersion: string;
      qualitySignals: Record<string, boolean>;
    };
    events: Array<{ kind: string; version: string }>;
  };
  expect(exported.schemaVersion).toBe("forgerank-repository-export-v3");
  expect(exported.events.map((event) => event.kind)).toEqual(
    expect.arrayContaining(["STAR_MILESTONE", "ACTIVITY_RESUMED", "NEW_TAGS_OBSERVED"]),
  );
  expect(exported.events.every((event) => event.version === "repository-events-v1")).toBe(true);
  expect(exported.gitAnalysis.readmeAnalysis).toMatchObject({
    version: "readme-structure-v1",
    sectionCount: 8,
  });
  expect(exported.gitAnalysis).toMatchObject({
    technologyDetectionVersion: "technology-detection-v2",
    qualitySignalsVersion: "repository-quality-signals-v2",
    qualitySignals: {
      releaseAutomation: true,
      dependencyManagement: true,
      documentation: true,
    },
  });
});

test("comparison builder creates a rich, shareable three-repository view", async ({ page }) => {
  await page.goto("/compare");
  await page.getByRole("button", { name: "Add repository" }).click();
  const thirdRepository = page.getByRole("textbox", { name: "Repository 3", exact: true });
  await thirdRepository.fill("sveltejs/svelte");
  await thirdRepository.press("Enter");
  await expect(page).toHaveURL(/\/compare\/facebook\/react,vuejs\/core,sveltejs\/svelte/);
  await expect(page.getByText("facebook/react", { exact: true })).toBeVisible();
  await expect(page.getByText("vuejs/core", { exact: true })).toBeVisible();
  await expect(page.getByText("sveltejs/svelte", { exact: true })).toBeVisible();
  await expect(page.getByText("Comparable growth unavailable")).toBeVisible();
  await expect(page.getByText("Commits / 90d").first()).toBeVisible();
  await expect(page.getByText("Git authors / 90d").first()).toBeVisible();
});

test("ecosystem comparison exposes indexed scope and coverage denominators", async ({ page }) => {
  await page.goto("/compare/ecosystems/typescript,rust");
  await expect(page.getByRole("heading", { name: "TypeScript vs Rust" })).toBeVisible();
  await expect(page.getByText("Indexed dataset boundary")).toBeVisible();
  await expect(page.getByText("Repositories indexed").first()).toBeVisible();
  await expect(page.getByText("Score coverage").first()).toBeVisible();
  await expect(page.getByText("Git analysis coverage").first()).toBeVisible();
  await expect(page.getByText(/do not estimate all repositories on GitHub/i)).toBeVisible();
});

test("developer detail separates project evidence from confirmed identity", async ({ page }) => {
  await page.goto("/d/sharkdp");
  await expect(page.getByRole("heading", { name: "David Peter" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Repository activity" })).toBeVisible();
  await expect(
    page.getByText(/project-level Git signals, not personal contribution totals/i),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Multi-author work" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Account-linked contributions" })).toBeVisible();
  await expect(page.getByText(/will not infer one from a name or commit email/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Evidence events" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Request correction or removal" })).toBeVisible();
});

test("developer leaderboards use distinct shareable evidence categories", async ({ page }) => {
  await page.goto("/developers?category=collaboration");
  await expect(
    page.getByRole("heading", { name: "Developer impact, with boundaries" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Collaboration", exact: true })).toHaveClass(
    /active/,
  );
  await expect(page.getByLabel("Developer leaderboard coverage")).toContainText(
    "Confirmed profiles",
  );
  await expect(page.getByText("Eligible / confirmed")).toBeVisible();
  await expect(page.getByText(/Account-age filtering is withheld/i)).toBeVisible();
  await page.getByLabel("Project activity").selectOption("90");
  await page.getByLabel("Evidence archetype").selectOption("collaborator");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/activity=90/);
  await expect(page).toHaveURL(/archetype=collaborator/);
  await page.getByRole("link", { name: "Rising", exact: true }).click();
  await expect(page).toHaveURL(/category=rising/);
  await expect(page.getByText(/real snapshot at least 30 days earlier/i)).toBeVisible();
  await expect(
    page.getByText(/No profiles meet the Rising evidence rules|30d score change/i).first(),
  ).toBeVisible();
});

test("language history renders without hydration errors", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/language/rust");
  await expect(page.getByRole("heading", { name: "Indexed attention over time" })).toBeVisible();
  const chart = page.getByRole("img", { name: "Observed star history" });
  if (await chart.count()) await expect(chart).toBeVisible();
  else await expect(page.getByText(/no historical values are reconstructed/i)).toBeVisible();
  await expect.poll(() => pageErrors).toEqual([]);
});

test("daily report exposes deterministic sections and indexed coverage", async ({ page }) => {
  await page.goto("/daily");
  await expect(page.getByText("Indexed boundary")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fastest rising" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Largest rank changes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "New breakout projects" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Languages gaining momentum" })).toBeVisible();
  await expect(
    page.getByText(/does not imply every repository was fetched that day/i),
  ).toBeVisible();
});

test("weekly report keeps rankings and developer spotlight inside evidence boundaries", async ({
  page,
}) => {
  await page.goto("/weekly");
  await expect(page.getByRole("heading", { name: "The week in open source" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Top 20 repositories" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Developer spotlight" })).toBeVisible();
  await expect(
    page.getByText(/does not infer account identity from Git author names/i),
  ).toBeVisible();
  await expect(page.getByText(/Missing daily observations reduce coverage/i)).toBeVisible();
});

test("repository submission queues work without remote auth", async ({ page }) => {
  await page.goto("/index");
  await page
    .getByPlaceholder("https://github.com/owner/repository")
    .fill("https://github.com/forgerank/e2e-fixture");
  await page.getByRole("button", { name: "Request indexing" }).click();
  await expect(page.getByText(/added to the indexing queue|already queued/)).toBeVisible();
});

test("mobile leaderboard uses cards instead of a squeezed table", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/repositories");
  await expect(page.locator(".repository-table-wrap")).toBeHidden();
  await expect(page.locator(".repository-table-mobile")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
});
