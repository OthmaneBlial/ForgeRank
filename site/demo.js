const demoRepositories = [
  {
    slug: "relay-ui",
    name: "demo-labs/relay-ui",
    description: "A fictional component library with a growing contributor cohort.",
    language: "TypeScript",
    score: 71,
    confidence: 0.92,
    stars: "2.5K",
    activity: 38,
    status: "Growing",
    growth: { "7d": "+1.6%", "30d": "+2.9%", "90d": "+7.2%" },
    history: { "7d": [67, 69, 71], "30d": [63, 67, 71], "90d": [58, 64, 71] },
    dimensions: [
      ["Impact", 23, 25, "Observed reach is established inside this sample cohort."],
      ["Momentum", 15, 20, "Three comparable observations show sustained positive movement."],
      ["Health", 16, 20, "Recent synthetic Git activity spans all twelve sampled weeks."],
      ["Community", 10, 15, "Fourteen sample authors reduce contributor concentration."],
      ["Engineering", 7, 10, "Tests, documentation, CI, and release automation are present."],
      ["Trust", 6, 10, "Source provenance is complete; long-run history is still bounded."],
    ],
  },
  {
    slug: "atlas-cli",
    name: "demo-labs/atlas-cli",
    description: "A synthetic command-line toolkit used to demonstrate transparent ranking.",
    language: "Rust",
    score: 70,
    confidence: 0.89,
    stars: "1.4K",
    activity: 24,
    status: "Revived",
    growth: { "7d": "+6.3%", "30d": "+8.0%", "90d": "+38.8%" },
    history: { "7d": [62, 68, 70], "30d": [57, 64, 70], "90d": [48, 55, 70] },
    dimensions: [
      ["Impact", 18, 25, "Reach is moderate inside the four-project sample."],
      ["Momentum", 17, 20, "Recent movement follows a fully observed quiet interval."],
      ["Health", 18, 20, "Activity resumed across ten of twelve sampled weeks."],
      ["Community", 11, 15, "Seven sample authors contribute without a single-author majority."],
      ["Engineering", 8, 10, "Repository structures expose tests, CI, and documentation."],
      ["Trust", 7, 10, "The revival reason retains its bounded Git evidence."],
    ],
  },
  {
    slug: "pulse-kit",
    name: "open-sample/pulse-kit",
    description: "A synthetic interface toolkit created for the isolated ForgeRank demo.",
    language: "TypeScript",
    score: 69,
    confidence: 0.92,
    stars: "1.8K",
    activity: 31,
    status: "Growing",
    growth: { "7d": "+3.7%", "30d": "+6.5%", "90d": "+10.9%" },
    history: { "7d": [65, 67, 69], "30d": [61, 65, 69], "90d": [57, 62, 69] },
    dimensions: [
      ["Impact", 20, 25, "Observed reach is second in the sample cohort."],
      ["Momentum", 15, 20, "Comparable snapshots show steady rather than explosive growth."],
      ["Health", 16, 20, "Synthetic activity appears in eleven of twelve sampled weeks."],
      ["Community", 10, 15, "The contributor estimate is distributed across ten authors."],
      ["Engineering", 7, 10, "The sample tree includes standard project structures."],
      ["Trust", 7, 10, "Evidence fields are complete and use one parser version."],
    ],
  },
  {
    slug: "streamline",
    name: "open-sample/streamline",
    description: "A fictional reactive library used to exercise comparison and momentum views.",
    language: "TypeScript",
    score: 64,
    confidence: 0.88,
    stars: "970",
    activity: 19,
    status: "Growing",
    growth: { "7d": "+4.9%", "30d": "+9.0%", "90d": "+14.4%" },
    history: { "7d": [60, 62, 64], "30d": [56, 60, 64], "90d": [51, 57, 64] },
    dimensions: [
      ["Impact", 17, 25, "Observed reach is the smallest in this sample cohort."],
      ["Momentum", 14, 20, "Relative movement is positive across three retained observations."],
      ["Health", 16, 20, "Nine of twelve sampled weeks contain activity."],
      ["Community", 10, 15, "Six sample authors provide moderate distribution."],
      ["Engineering", 8, 10, "Tests and documentation are present in the sample tree."],
      ["Trust", 8, 10, "Provenance is complete, though the corpus remains intentionally tiny."],
    ],
  },
];

const demoState = { selected: demoRepositories[0], window: "7d" };
const rankingList = document.querySelector("#demo-ranking-list");
const windowButtons = document.querySelectorAll("[data-window]");

function text(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

function renderRanking() {
  if (!rankingList) return;
  rankingList.innerHTML = demoRepositories
    .map(
      (repository, index) => `
        <button type="button" class="demo-rank-row" data-repository="${repository.slug}"
          aria-pressed="${repository === demoState.selected}">
          <span class="demo-rank-position">#${String(index + 1).padStart(2, "0")}</span>
          <span class="demo-rank-name">
            <strong>${repository.name}</strong>
            <small>${repository.language} · ${repository.status}</small>
          </span>
          <span class="demo-rank-score">${repository.score}</span>
        </button>`,
    )
    .join("");

  rankingList.querySelectorAll("[data-repository]").forEach((button) => {
    button.addEventListener("click", () => {
      const repository = demoRepositories.find(
        (candidate) => candidate.slug === button.dataset.repository,
      );
      if (!repository || repository === demoState.selected) return;
      demoState.selected = repository;
      render();
    });
  });
}

function renderDimensions() {
  const list = document.querySelector("#demo-dimension-list");
  if (!list) return;
  list.innerHTML = demoState.selected.dimensions
    .map(
      ([name, value, maximum, reason]) => `
        <div class="demo-dimension-row">
          <div class="demo-dimension-line">
            <strong>${name}</strong>
            <span><b style="width:${(value / maximum) * 100}%"></b></span>
            <em>${value}/${maximum}</em>
          </div>
          <p>${reason}</p>
        </div>`,
    )
    .join("");
}

function renderHistory() {
  const values = demoState.selected.history[demoState.window];
  const xPositions = [24, 210, 396];
  const y = (value) => 156 - ((value - 45) / 30) * 132;
  const points = values.map((value, index) => ({ x: xPositions[index], y: y(value), value }));
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ");
  document.querySelector("#demo-history-path")?.setAttribute("d", path);
  const pointGroup = document.querySelector("#demo-history-points");
  if (pointGroup) {
    pointGroup.innerHTML = points
      .map(
        (point) =>
          `<circle cx="${point.x}" cy="${point.y}" r="5"></circle><text x="${point.x}" y="${point.y - 13}" text-anchor="middle">${point.value}</text>`,
      )
      .join("");
  }
  const change = values.at(-1) - values[0];
  text("#demo-history-change", `${change >= 0 ? "+" : ""}${change.toFixed(1)} pts`);
}

function renderEvidence() {
  const evidence = [
    ["Repository page", "Available", "Synthetic public-page observation", "ready"],
    ["HTTPS Git", "Available", `${demoState.selected.activity} sample commits in 30 days`, "ready"],
    ["Snapshots", "3 retained", `${demoState.window} comparable window`, "ready"],
    [
      "Public identity link",
      "Unavailable",
      "No account identity is inferred in sample mode",
      "missing",
    ],
  ];
  const list = document.querySelector("#demo-evidence-list");
  if (!list) return;
  list.innerHTML = evidence
    .map(
      ([source, status, detail, state]) => `
        <div class="demo-evidence-item">
          <span>${source}</span>
          <strong class="${state}"><i></i>${status}</strong>
          <small>${detail}</small>
        </div>`,
    )
    .join("");
}

function renderDetail() {
  const repository = demoState.selected;
  const rank = demoRepositories.indexOf(repository) + 1;
  text(
    "#demo-repository-kicker",
    `Rank #${String(rank).padStart(2, "0")} / ${repository.language}`,
  );
  text("#demo-repository-name", repository.name);
  text("#demo-repository-description", repository.description);
  text("#demo-score-value", String(repository.score));
  text("#demo-stars", repository.stars);
  text("#demo-growth-label", `${demoState.window.replace("d", "-day")} growth`);
  text("#demo-growth", repository.growth[demoState.window]);
  text("#demo-activity", String(repository.activity));
  text("#demo-confidence", `× ${repository.confidence.toFixed(2)} confidence`);
  renderDimensions();
  renderHistory();
  renderEvidence();
}

function render() {
  renderRanking();
  renderDetail();
  windowButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.window === demoState.window));
  });
}

windowButtons.forEach((button) => {
  button.addEventListener("click", () => {
    if (!button.dataset.window || button.dataset.window === demoState.window) return;
    demoState.window = button.dataset.window;
    render();
  });
});

render();
