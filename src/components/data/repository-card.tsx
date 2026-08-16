import { ArrowDownRight, ArrowRight, ArrowUpRight, GitFork, Star } from "lucide-react";
import Link from "next/link";

import { formatCompactNumber } from "@/domain/format";
import type { RepositoryListItem } from "@/domain/repository";

export type RepositoryCardEvidence = {
  periodLabel: string;
  growth: number | null;
  growthConfidence: string;
  historySpanDays: number;
  anomaly: string | null;
  commits90d: number | null;
  uniqueAuthors90d: number | null;
  ageDays: number | null;
};

export function RepositoryCard({
  repository,
  index,
  variant = "standard",
  evidence,
}: {
  repository: RepositoryListItem;
  index?: number;
  variant?: "standard" | "compact" | "leaderboard";
  evidence?: RepositoryCardEvidence;
}) {
  const movement =
    repository.rank !== null && repository.previousRank !== null
      ? repository.previousRank - repository.rank
      : null;
  return (
    <article className={`repository-card repository-card-${variant}`}>
      {index !== undefined && (
        <div className="card-rank">
          <span>#{String(index + 1).padStart(2, "0")}</span>
          {movement === null ? (
            <small>NEW</small>
          ) : movement > 0 ? (
            <small className="positive">↑{movement}</small>
          ) : movement < 0 ? (
            <small className="negative">↓{Math.abs(movement)}</small>
          ) : (
            <small>—</small>
          )}
        </div>
      )}
      <div className="repo-card-main">
        <div className="repo-card-kicker">
          <span className="language-dot" />
          {repository.primaryLanguage ?? "Language unavailable"}
          {repository.maturity && (
            <span className="maturity-tag">{repository.maturity.toLowerCase()}</span>
          )}
        </div>
        <h3>
          <Link href={`/r/${repository.owner}/${repository.name}`}>
            <span>{repository.owner}/</span>
            {repository.name}
          </Link>
        </h3>
        <p>{repository.description ?? "Public metadata has not been observed yet."}</p>
        <div className="repo-card-metrics">
          <span title={repository.stars?.toLocaleString()}>
            <Star size={14} /> {formatCompactNumber(repository.stars)}
          </span>
          <span title={repository.forks?.toLocaleString()}>
            <GitFork size={14} /> {formatCompactNumber(repository.forks)}
          </span>
          <span
            className={
              (evidence?.growth ?? repository.sevenDayGrowth) === null ? "muted" : "positive"
            }
            title={evidence?.anomaly ?? undefined}
          >
            {evidence
              ? evidence.anomaly
                ? `${evidence.periodLabel} under review`
                : evidence.growth === null
                  ? `${evidence.periodLabel} history pending`
                  : `+${formatCompactNumber(evidence.growth)} / ${evidence.periodLabel}`
              : repository.sevenDayGrowth === null
                ? "7d history pending"
                : `+${formatCompactNumber(repository.sevenDayGrowth)} / 7d`}
          </span>
        </div>
        {evidence ? (
          <div className="repo-card-evidence">
            <span>{formatEvidenceCount(evidence.commits90d)} commits / 90d</span>
            <span>{formatEvidenceCount(evidence.uniqueAuthors90d)} Git authors / 90d</span>
            <span>{formatRepositoryAge(evidence.ageDays)}</span>
            <span>
              {evidence.growth === null
                ? "Growth unavailable"
                : `${evidence.growthConfidence.toLocaleLowerCase()} confidence · ${evidence.historySpanDays}d span`}
            </span>
          </div>
        ) : null}
      </div>
      <div className="repo-card-score">
        <span>ForgeRank</span>
        <strong>{repository.score === null ? "—" : Math.round(repository.score)}</strong>
        <small>{repository.scoreConfidence.toLowerCase()} confidence</small>
      </div>
      <Link
        className="card-open"
        href={`/r/${repository.owner}/${repository.name}`}
        aria-label={`Open ${repository.fullName}`}
      >
        {movement !== null && movement > 0 ? (
          <ArrowUpRight size={17} />
        ) : movement !== null && movement < 0 ? (
          <ArrowDownRight size={17} />
        ) : (
          <ArrowRight size={17} />
        )}
      </Link>
    </article>
  );
}

function formatEvidenceCount(value: number | null): string {
  return value === null ? "Unavailable" : value.toLocaleString("en");
}

function formatRepositoryAge(ageDays: number | null): string {
  if (ageDays === null) return "Age unavailable";
  if (ageDays < 365) return `${ageDays}d old`;
  return `${(ageDays / 365).toFixed(1)}y old`;
}
