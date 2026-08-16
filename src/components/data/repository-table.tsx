import { ArrowDown, ArrowUp, GitCommitHorizontal, GitFork, Star, Users } from "lucide-react";
import Link from "next/link";

import { formatCompactNumber, formatExactNumber } from "@/domain/format";
import type { RepositoryLeaderboardSort } from "@/domain/repository-leaderboard";
import type { RepositoryListItem } from "@/domain/repository";
import { RepositoryCard, type RepositoryCardEvidence } from "./repository-card";

export function RepositoryTable({
  repositories,
  signalLabel = "7D signal",
  signals,
  evidence,
  sortHrefs,
}: {
  repositories: RepositoryListItem[];
  signalLabel?: string;
  signals?: Record<string, { score: number; confidence: string }>;
  evidence?: Record<string, RepositoryCardEvidence>;
  sortHrefs?: Partial<Record<RepositoryLeaderboardSort, string>>;
}) {
  const richLeaderboard = evidence !== undefined;
  return (
    <>
      <div className="repository-table-wrap">
        <table className="repository-table">
          <caption className="sr-only">
            Ranked repositories with observed reach, snapshot growth, bounded Git activity,
            lifecycle, and ForgeRank score. Git authors are not inferred public accounts.
          </caption>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Repository</th>
              <th scope="col">Language</th>
              <SortableHeader href={sortHrefs?.stars}>Observed reach</SortableHeader>
              <SortableHeader href={richLeaderboard ? sortHrefs?.growth : undefined}>
                {signalLabel}
              </SortableHeader>
              {richLeaderboard ? (
                <>
                  <SortableHeader href={sortHrefs?.activity}>Git activity</SortableHeader>
                  <th scope="col">Lifecycle</th>
                </>
              ) : null}
              <SortableHeader href={sortHrefs?.score}>ForgeRank</SortableHeader>
            </tr>
          </thead>
          <tbody>
            {repositories.map((repository, index) => {
              const movement =
                repository.rank !== null && repository.previousRank !== null
                  ? repository.previousRank - repository.rank
                  : null;
              const signal = signals?.[repository.id];
              const detail = evidence?.[repository.id];
              return (
                <tr key={repository.id}>
                  <td>
                    <div className="table-rank">
                      <strong>#{repository.rank ?? index + 1}</strong>
                      {movement === null ? (
                        <small>NEW</small>
                      ) : movement > 0 ? (
                        <small className="positive">
                          <ArrowUp size={10} aria-hidden="true" />
                          {movement}
                        </small>
                      ) : movement < 0 ? (
                        <small className="negative">
                          <ArrowDown size={10} aria-hidden="true" />
                          {Math.abs(movement)}
                        </small>
                      ) : (
                        <small>—</small>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="table-repository">
                      <Link href={`/r/${repository.fullName}`}>
                        <span>{repository.owner}/</span>
                        {repository.name}
                      </Link>
                      <p>
                        {repository.description ?? "Public metadata has not been observed yet."}
                      </p>
                    </div>
                  </td>
                  <td>
                    <span className="language-cell">
                      <i />
                      {repository.primaryLanguage ?? "Unavailable"}
                    </span>
                  </td>
                  <td>
                    <div className="reach-cell">
                      <span title={`${formatExactNumber(repository.stars)} observed stars`}>
                        <Star size={12} aria-hidden="true" />
                        {formatCompactNumber(repository.stars)}
                      </span>
                      <span title={`${formatExactNumber(repository.forks)} observed forks`}>
                        <GitFork size={12} aria-hidden="true" />
                        {formatCompactNumber(repository.forks)}
                      </span>
                    </div>
                  </td>
                  <td>{renderSignal(repository, signal, detail)}</td>
                  {richLeaderboard ? (
                    <>
                      <td>{renderActivity(repository, detail)}</td>
                      <td>{renderLifecycle(repository, detail)}</td>
                    </>
                  ) : null}
                  <td>
                    <div className="table-score">
                      <strong>
                        {repository.score === null ? "—" : Math.round(repository.score)}
                      </strong>
                      <span>{repository.scoreConfidence.toLowerCase()}</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="repository-table-mobile">
        {repositories.map((repository, index) => (
          <RepositoryCard
            variant="leaderboard"
            key={repository.id}
            repository={repository}
            index={index}
            evidence={evidence?.[repository.id]}
          />
        ))}
      </div>
    </>
  );
}

function SortableHeader({ href, children }: { href?: string; children: React.ReactNode }) {
  return <th scope="col">{href ? <Link href={href}>{children}</Link> : children}</th>;
}

function renderSignal(
  repository: RepositoryListItem,
  signal: { score: number; confidence: string } | undefined,
  evidence: RepositoryCardEvidence | undefined,
) {
  if (signal) {
    return (
      <div className="table-score">
        <strong>{signal.score.toFixed(1)}</strong>
        <span>{signal.confidence.toLowerCase()}</span>
      </div>
    );
  }
  if (evidence) {
    if (evidence.anomaly)
      return (
        <span className="table-evidence-warning" title={evidence.anomaly}>
          Under review
        </span>
      );
    if (evidence.growth === null)
      return <span className="history-pending">Insufficient {evidence.periodLabel} history</span>;
    return (
      <div className="table-growth">
        <strong className="positive">+{formatCompactNumber(evidence.growth)}</strong>
        <span>
          {evidence.growthConfidence.toLocaleLowerCase()} · {evidence.historySpanDays}d span
        </span>
      </div>
    );
  }
  return repository.sevenDayGrowth === null ? (
    <span className="history-pending">Insufficient history</span>
  ) : (
    <strong className="positive">+{formatCompactNumber(repository.sevenDayGrowth)}</strong>
  );
}

function renderActivity(
  repository: RepositoryListItem,
  evidence: RepositoryCardEvidence | undefined,
) {
  if (!evidence || evidence.commits90d === null)
    return <span className="history-pending">Git analysis unavailable</span>;
  return (
    <div className="table-activity">
      <span>
        <GitCommitHorizontal size={12} aria-hidden="true" />
        <strong>{evidence.commits90d.toLocaleString("en")}</strong> commits
      </span>
      <span>
        <Users size={12} aria-hidden="true" />
        {evidence.uniqueAuthors90d === null
          ? "Authors unavailable"
          : `${evidence.uniqueAuthors90d.toLocaleString("en")} Git authors`}
      </span>
      <small>
        {repository.lastActivityAt
          ? `Latest ${repository.lastActivityAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}`
          : "Latest activity unavailable"}
      </small>
    </div>
  );
}

function renderLifecycle(
  repository: RepositoryListItem,
  evidence: RepositoryCardEvidence | undefined,
) {
  return (
    <div className="table-lifecycle">
      <strong>{repository.maturity?.toLocaleLowerCase() ?? "Unavailable"}</strong>
      <span>{formatRepositoryAge(evidence?.ageDays ?? null)}</span>
      <small>{repository.state.toLocaleLowerCase()}</small>
    </div>
  );
}

function formatRepositoryAge(ageDays: number | null): string {
  if (ageDays === null) return "Age unavailable";
  if (ageDays < 365) return `${ageDays}d old`;
  return `${(ageDays / 365).toFixed(1)}y old`;
}
