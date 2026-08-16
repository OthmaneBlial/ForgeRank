import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { InsufficientData } from "@/components/data/empty-state";
import { RepositoryCard } from "@/components/data/repository-card";
import type { DiscoveryRanking } from "@/domain/discovery";
import { formatCompactNumber } from "@/domain/format";
import type { RepositoryListItem } from "@/domain/repository";
import type { EcosystemMovement, RankMovement } from "@/domain/reports";
import type { ReportCoverage } from "@/application/report-read-model";

export function ReportCoveragePanel({
  coverage,
  windowLabel,
}: {
  coverage: ReportCoverage;
  windowLabel: string;
}) {
  return (
    <section className="report-coverage" aria-label={`${windowLabel} report coverage`}>
      <div>
        <span>Indexed boundary</span>
        <strong>{coverage.indexedRepositories}</strong>
        <small>of {coverage.identifiers} identifiers observed</small>
      </div>
      <div>
        <span>Scored coverage</span>
        <strong>{coverage.scoredRepositories}</strong>
        <small>current versioned scores</small>
      </div>
      <div>
        <span>Latest ranking</span>
        <strong>{coverage.rankedRepositories || "—"}</strong>
        <small>{formatTimestamp(coverage.latestRankingAt)}</small>
      </div>
      <div>
        <span>Latest observation</span>
        <strong>{coverage.latestObservationAt ? "Observed" : "—"}</strong>
        <small>{formatTimestamp(coverage.latestObservationAt)}</small>
      </div>
      <div>
        <span>Ecosystem history</span>
        <strong>{coverage.ecosystemSnapshotsInQuery}</strong>
        <small>snapshots in bounded query</small>
      </div>
    </section>
  );
}

export function DiscoveryReportSection({
  icon: Icon,
  title,
  signalLabel,
  rankings,
  empty,
}: {
  icon: LucideIcon;
  title: string;
  signalLabel: string;
  rankings: DiscoveryRanking[];
  empty: string;
}) {
  return (
    <ReportSectionHeading icon={Icon} title={title} signalLabel={signalLabel}>
      {rankings.length > 0 ? (
        <ol className="report-signal-list">
          {rankings.map((ranking, index) => (
            <li key={ranking.repository.id}>
              <span className="report-position">#{String(index + 1).padStart(2, "0")}</span>
              <div>
                <Link href={`/r/${ranking.repository.fullName}`}>
                  <span>{ranking.repository.owner}/</span>
                  <strong>{ranking.repository.name}</strong>
                </Link>
                <p>{ranking.evidence.join(" · ")}</p>
                <small>
                  {ranking.observationCount} observations across {ranking.historySpanDays} days ·{" "}
                  {ranking.confidence.toLowerCase()} confidence
                </small>
              </div>
              <div className="report-signal-score">
                <span>Signal</span>
                <strong>{ranking.signalScore.toFixed(1)}</strong>
                <small>/ 100</small>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <InsufficientData action={false} detail={empty} />
      )}
    </ReportSectionHeading>
  );
}

export function NewRepositoriesReportSection({
  icon: Icon,
  title,
  windowLabel,
  repositories,
  empty,
}: {
  icon: LucideIcon;
  title: string;
  windowLabel: string;
  repositories: RepositoryListItem[];
  empty: string;
}) {
  return (
    <ReportSectionHeading icon={Icon} title={title} signalLabel={windowLabel}>
      {repositories.length > 0 ? (
        <div className="repository-grid">
          {repositories.map((repository, index) => (
            <RepositoryCard
              key={repository.id}
              repository={repository}
              index={index}
              variant="compact"
            />
          ))}
        </div>
      ) : (
        <InsufficientData action={false} detail={empty} />
      )}
    </ReportSectionHeading>
  );
}

export function RankMoversReportSection({
  icon: Icon,
  movements,
  empty,
}: {
  icon: LucideIcon;
  movements: RankMovement[];
  empty: string;
}) {
  return (
    <ReportSectionHeading icon={Icon} title="Largest rank changes" signalLabel="Completed rankings">
      {movements.length > 0 ? (
        <div className="report-movement-grid">
          {movements.map((movement) => (
            <Link key={movement.repository.id} href={`/r/${movement.repository.fullName}`}>
              <span>{movement.repository.fullName}</span>
              <strong className={movement.direction === "UP" ? "positive" : "negative"}>
                {movement.direction === "UP" ? "↑" : "↓"} {movement.places}
              </strong>
              <small>
                #{movement.repository.previousRank} → #{movement.repository.rank}
              </small>
            </Link>
          ))}
        </div>
      ) : (
        <InsufficientData action={false} detail={empty} />
      )}
    </ReportSectionHeading>
  );
}

export function EcosystemReportSection({
  icon: Icon,
  movements,
  windowLabel,
  empty,
}: {
  icon: LucideIcon;
  movements: EcosystemMovement[];
  windowLabel: string;
  empty: string;
}) {
  return (
    <ReportSectionHeading icon={Icon} title="Languages gaining momentum" signalLabel={windowLabel}>
      {movements.length > 0 ? (
        <div className="report-ecosystem-grid">
          {movements.map((movement) => (
            <Link key={movement.ecosystemKey} href={`/language/${movement.ecosystemKey}`}>
              <span>{movement.ecosystemName}</span>
              <strong>+{formatCompactNumber(movement.starGrowth)} observed stars</strong>
              <p>
                {movement.starGrowthPercent === null
                  ? "Percentage unavailable"
                  : `${movement.starGrowthPercent.toFixed(2)}% across the observed baseline`}
              </p>
              <small>
                {movement.scoredRepositoryCount}/{movement.repositoryCount} scored ·{" "}
                {movement.historySpanDays}d actual span
              </small>
            </Link>
          ))}
        </div>
      ) : (
        <InsufficientData action={false} detail={empty} />
      )}
    </ReportSectionHeading>
  );
}

function ReportSectionHeading({
  icon: Icon,
  title,
  signalLabel,
  children,
}: {
  icon: LucideIcon;
  title: string;
  signalLabel: string;
  children: React.ReactNode;
}) {
  return (
    <section className="report-section">
      <div className="section-heading compact-heading">
        <div>
          <p className="eyebrow">
            <Icon size={11} aria-hidden="true" /> {signalLabel}
          </p>
          <h2>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function formatTimestamp(value: Date | null): string {
  if (!value) return "Unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(value);
}
