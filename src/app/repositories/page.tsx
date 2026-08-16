import { Filter, RotateCcw, Search } from "lucide-react";
import Link from "next/link";

import {
  getRepositoryLeaderboardReadModel,
  type RepositoryLeaderboardEntry,
} from "@/application/repository-leaderboard-read-model";
import { InsufficientData } from "@/components/data/empty-state";
import { RepositoryTable } from "@/components/data/repository-table";
import { PageHeader } from "@/components/shell/page-header";
import {
  REPOSITORY_AGE_FILTERS,
  REPOSITORY_LEADERBOARD_PERIODS,
  REPOSITORY_LEADERBOARD_SORTS,
  REPOSITORY_STAR_BANDS,
  REPOSITORY_STATUS_FILTERS,
  normalizeRepositoryLeaderboardRequest,
  type RepositoryAgeFilter,
  type RepositoryLeaderboardPeriod,
  type RepositoryLeaderboardRequest,
  type RepositoryLeaderboardSort,
  type RepositoryStarBand,
  type RepositoryStatusFilter,
} from "@/domain/repository-leaderboard";

export const dynamic = "force-dynamic";

type Params = Promise<Record<string, string | string[] | undefined>>;

const sortLabels: Record<RepositoryLeaderboardSort, string> = {
  score: "ForgeRank score",
  stars: "Star count",
  growth: "Observed star growth",
  forks: "Observed forks",
  activity: "Git commits / 90d",
  community: "Community dimension",
  momentum: "Momentum",
  health: "Health dimension",
  "new-rising": "New and rising",
  recent: "Recently discovered",
};
const periodLabels: Record<RepositoryLeaderboardPeriod, string> = {
  "1d": "24h",
  "7d": "7d",
  "30d": "30d",
  "90d": "90d",
  "1y": "1y",
  all: "All tracking",
};
const starLabels: Record<RepositoryStarBand, string> = {
  all: "Any observed stars",
  "under-1k": "Under 1k",
  "1k-5k": "1k–5k",
  "5k-10k": "5k–10k",
  "10k-50k": "10k–50k",
  "50k-100k": "50k–100k",
  "100k-plus": "100k or more",
};
const ageLabels: Record<RepositoryAgeFilter, string> = {
  all: "Any observed age",
  new: "New / under 90 days",
  "under-1": "Under 1 year",
  "1-3": "1–3 years",
  "3-5": "3–5 years",
  "5-plus": "5 years or older",
};
const statusLabels: Record<RepositoryStatusFilter, string> = {
  all: "Any lifecycle",
  active: "Active lifecycle",
  stable: "Established or mature",
  slowing: "Slowing",
  dormant: "Dormant",
};

export default async function RepositoriesPage({ searchParams }: { searchParams: Params }) {
  const request = normalizeRepositoryLeaderboardRequest(await searchParams);
  let model: Awaited<ReturnType<typeof getRepositoryLeaderboardReadModel>> | null = null;
  try {
    model = await getRepositoryLeaderboardReadModel(request);
  } catch {
    model = null;
  }
  const languages = [...(model?.options.languages ?? [])];
  if (request.language && !languages.includes(request.language))
    languages.unshift(request.language);
  const repositories = model?.entries.map((entry) => entry.repository) ?? [];
  const evidence = Object.fromEntries(
    (model?.entries ?? []).map((entry) => [
      entry.repository.id,
      entryEvidence(entry, request.period),
    ]),
  );
  const sortHrefs = Object.fromEntries(
    REPOSITORY_LEADERBOARD_SORTS.map((sort) => [
      sort,
      repositoryLeaderboardHref({ ...request, sort, page: 1 }),
    ]),
  );

  return (
    <>
      <PageHeader
        eyebrow="Index / repositories"
        title="Repository rankings"
        description="Explore ForgeRank's indexed universe by observed reach, snapshot growth, bounded Git activity, score dimensions, age, and lifecycle—with missing evidence left visible."
      />
      <section className="shell content-section repository-leaderboard-workbench">
        <form className="filter-bar repository-filter-bar" method="get">
          <label className="filter-search repository-filter-search">
            <Search size={15} aria-hidden="true" />
            <span className="sr-only">Search repositories</span>
            <input
              name="q"
              defaultValue={request.query}
              placeholder="Search name, owner, description…"
            />
          </label>
          <label>
            <span>Ranking</span>
            <select name="sort" defaultValue={request.sort}>
              {REPOSITORY_LEADERBOARD_SORTS.map((sort) => (
                <option key={sort} value={sort}>
                  {sortLabels[sort]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Growth period</span>
            <select name="period" defaultValue={request.period}>
              {REPOSITORY_LEADERBOARD_PERIODS.map((period) => (
                <option key={period} value={period}>
                  {periodLabels[period]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Language</span>
            <select name="language" defaultValue={request.language ?? ""}>
              <option value="">All observed languages</option>
              {languages.map((language) => (
                <option key={language}>{language}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Observed stars</span>
            <select name="stars" aria-label="Observed stars" defaultValue={request.stars}>
              {REPOSITORY_STAR_BANDS.map((band) => (
                <option key={band} value={band}>
                  {starLabels[band]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Repository age</span>
            <select name="age" defaultValue={request.age}>
              {REPOSITORY_AGE_FILTERS.map((age) => (
                <option key={age} value={age}>
                  {ageLabels[age]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Lifecycle</span>
            <select name="status" defaultValue={request.status}>
              {REPOSITORY_STATUS_FILTERS.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="repository-fork-toggle">
            <input
              name="forks"
              type="checkbox"
              value="include"
              defaultChecked={request.includeForks}
            />
            <span>
              Include observed forks<small>Original repositories are the default cohort.</small>
            </span>
          </label>
          <div className="repository-filter-actions">
            <button className="button button-primary" type="submit">
              <Filter size={14} aria-hidden="true" /> Apply
            </button>
            <Link className="button button-secondary" href="/repositories">
              <RotateCcw size={13} aria-hidden="true" /> Reset
            </Link>
          </div>
        </form>

        <div className="leaderboard-coverage-strip" aria-label="Repository leaderboard coverage">
          <CoverageMetric label="Filtered cohort" value={String(model?.coverage.filtered ?? 0)} />
          <CoverageMetric label="Scored" value={String(model?.coverage.scored ?? 0)} />
          <CoverageMetric
            label={`${periodLabels[request.period]} growth`}
            value={`${model?.coverage.growthAvailable ?? 0} / ${model?.coverage.filtered ?? 0}`}
          />
          <CoverageMetric
            label="Git-analyzed"
            value={`${model?.coverage.gitAnalyzed ?? 0} / ${model?.coverage.filtered ?? 0}`}
          />
          <CoverageMetric
            label="Indexed denominator"
            value={`${model?.coverage.indexed ?? 0} / ${model?.coverage.identifiers ?? 0}`}
          />
        </div>

        <div className="index-context repository-ranking-context">
          <span>
            {model && model.coverage.filtered > 0
              ? `Showing ${model.pagination.firstResult}–${model.pagination.lastResult} of ${model.coverage.filtered}`
              : "No matching observed repositories"}
            {` · ${sortLabels[request.sort]} · ${periodLabels[request.period]} growth window`}
          </span>
          <span>
            Growth requires a real boundary snapshot; Git authors are not inferred accounts.{" "}
            <Link href="/methodology">Methodology</Link>
          </span>
        </div>

        {repositories.length > 0 ? (
          <RepositoryTable
            repositories={repositories}
            signalLabel={`${periodLabels[request.period]} growth`}
            evidence={evidence}
            sortHrefs={sortHrefs}
          />
        ) : (
          <InsufficientData
            title={
              model ? "No indexed repositories match this view." : "Repository index unavailable."
            }
            detail={
              model
                ? "Broaden one or more filters. ForgeRank does not substitute repositories with missing language, age, lifecycle, or historical evidence into a filtered cohort."
                : "ForgeRank could not read its local repository index. No leaderboard values have been reconstructed."
            }
          />
        )}

        {model && model.pagination.pageCount > 1 ? (
          <nav className="pagination" aria-label="Leaderboard pages">
            {model.pagination.page > 1 ? (
              <Link
                href={repositoryLeaderboardHref({ ...request, page: model.pagination.page - 1 })}
              >
                Previous
              </Link>
            ) : null}
            <span>
              Page {model.pagination.page} / {model.pagination.pageCount}
            </span>
            {model.pagination.page < model.pagination.pageCount ? (
              <Link
                href={repositoryLeaderboardHref({ ...request, page: model.pagination.page + 1 })}
              >
                Next
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </>
  );
}

function entryEvidence(entry: RepositoryLeaderboardEntry, period: RepositoryLeaderboardPeriod) {
  return {
    periodLabel: periodLabels[period],
    growth: entry.growth.absolute,
    growthConfidence: entry.growth.confidence,
    historySpanDays: entry.growth.historySpanDays,
    anomaly: entry.growth.anomaly,
    commits90d: entry.commits90d,
    uniqueAuthors90d: entry.uniqueAuthors90d,
    ageDays: entry.ageDays,
  };
}

function CoverageMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function repositoryLeaderboardHref(request: RepositoryLeaderboardRequest): string {
  const params = new URLSearchParams();
  if (request.query) params.set("q", request.query);
  if (request.language) params.set("language", request.language);
  params.set("sort", request.sort);
  params.set("period", request.period);
  params.set("stars", request.stars);
  params.set("age", request.age);
  params.set("status", request.status);
  if (request.includeForks) params.set("forks", "include");
  if (request.page > 1) params.set("page", String(request.page));
  return `/repositories?${params.toString()}`;
}
