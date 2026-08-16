import {
  Activity,
  ArrowLeft,
  CircleGauge,
  Clock3,
  GitCommitHorizontal,
  GitFork,
  HeartPulse,
  Scale,
  Star,
  Users,
} from "lucide-react";
import Link from "next/link";

import { getRepositoryComparisonReadModel } from "@/application/comparison-read-model";
import { SaveComparison } from "@/components/compare/save-comparison";
import { InsufficientData } from "@/components/data/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { formatCompactNumber } from "@/domain/format";

export const dynamic = "force-dynamic";

export default async function ComparisonResultPage({
  params,
}: {
  params: Promise<{ repositories: string[] }>;
}) {
  const resolvedParams = await params;
  const raw = resolvedParams.repositories.map((segment) => decodeURIComponent(segment)).join("/");
  const model = await getRepositoryComparisonReadModel(raw.split(","));
  const available = model.entries.flatMap((entry) =>
    entry.repository ? [{ ...entry, repository: entry.repository }] : [],
  );
  const names = model.identifiers.map((identifier) => identifier.split("/")[1]).filter(Boolean);
  const maxStars = maximum(available.map((entry) => entry.repository.stars));
  const maxForks = maximum(available.map((entry) => entry.repository.forks));
  const maxCommits = maximum(available.map((entry) => entry.analysis?.commits90d ?? null));
  const maxContributors = maximum(
    available.map((entry) => entry.analysis?.uniqueAuthors90d ?? null),
  );

  return (
    <>
      <PageHeader
        eyebrow="Comparison / repository battle"
        title={names.length >= 2 ? names.join(" vs ") : "Choose at least two repositories"}
        description={`${available.length} of ${model.identifiers.length} requested repositories have records in ForgeRank's current indexed universe.`}
        aside={
          model.identifiers.length >= 2 ? (
            <SaveComparison repositories={model.identifiers} />
          ) : undefined
        }
      />
      <section className="shell content-section">
        <Link className="back-link" href="/compare">
          <ArrowLeft size={14} /> Change repositories
        </Link>
        {model.identifiers.length < 2 ? (
          <InsufficientData
            title="A comparison needs two repositories."
            detail="Use owner/repository identifiers. ForgeRank supports two to five unique repositories in a shareable URL."
          />
        ) : (
          <>
            <div className={`comparison-window ${model.window ? "comparison-window-ready" : ""}`}>
              <Clock3 size={18} />
              <div>
                <strong>
                  {model.window ? "Shared growth window" : "Comparable growth unavailable"}
                </strong>
                <p>
                  {model.window
                    ? `${model.window.start.toLocaleDateString("en")} – ${model.window.end.toLocaleDateString("en")}. Growth uses only observations inside this overlap.`
                    : "Every repository needs at least two valid observations inside the same time range. Current totals remain visible without synthetic history."}
                </p>
              </div>
              <span>{model.indexedUniverse} observed repositories in scope</span>
            </div>
            <div className="comparison-grid">
              {model.entries.map((entry) => {
                const repository = entry.repository;
                const analysis = entry.analysis;
                const growth = entry.growth;
                return (
                  <article key={entry.identifier} className="comparison-column">
                    <div className="comparison-column-head">
                      <span>{repository?.primaryLanguage ?? "Unavailable"}</span>
                      <h2>{entry.identifier}</h2>
                      <p>
                        {repository?.description ??
                          "This repository has not completed an observation."}
                      </p>
                      {analysis?.detectedTechnologies &&
                        analysis.detectedTechnologies.length > 0 && (
                          <div className="comparison-technologies">
                            {analysis.detectedTechnologies.slice(0, 4).map((technology) => (
                              <b key={technology.name}>{technology.name}</b>
                            ))}
                          </div>
                        )}
                    </div>
                    <ComparisonMetric
                      icon={Star}
                      label="Stars"
                      value={formatCompactNumber(repository?.stars ?? null)}
                      ratio={ratio(repository?.stars, maxStars)}
                    />
                    <ComparisonMetric
                      icon={GitFork}
                      label="Forks"
                      value={formatCompactNumber(repository?.forks ?? null)}
                      ratio={ratio(repository?.forks, maxForks)}
                    />
                    <ComparisonMetric
                      icon={CircleGauge}
                      label="ForgeRank"
                      value={
                        repository?.score === null || repository?.score === undefined
                          ? "Unavailable"
                          : `${repository.score.toFixed(1)}/100`
                      }
                      ratio={
                        repository?.score === null || repository?.score === undefined
                          ? undefined
                          : repository.score / 100
                      }
                    />
                    <ComparisonMetric
                      icon={HeartPulse}
                      label="Health"
                      value={
                        repository?.health === null || repository?.health === undefined
                          ? "Unavailable"
                          : `${repository.health.toFixed(1)}/20`
                      }
                      ratio={
                        repository?.health === null || repository?.health === undefined
                          ? undefined
                          : repository.health / 20
                      }
                    />
                    <ComparisonMetric
                      label="Community"
                      value={
                        repository?.community === null || repository?.community === undefined
                          ? "Unavailable"
                          : `${repository.community.toFixed(1)}/15`
                      }
                      ratio={
                        repository?.community === null || repository?.community === undefined
                          ? undefined
                          : repository.community / 15
                      }
                    />
                    <ComparisonMetric
                      label="Engineering"
                      value={
                        repository?.engineering === null || repository?.engineering === undefined
                          ? "Unavailable"
                          : `${repository.engineering.toFixed(1)}/10`
                      }
                      ratio={
                        repository?.engineering === null || repository?.engineering === undefined
                          ? undefined
                          : repository.engineering / 10
                      }
                    />
                    <ComparisonMetric
                      icon={Activity}
                      label="Comparable star growth"
                      value={
                        !model.window ||
                        growth?.absoluteGrowth === null ||
                        growth?.absoluteGrowth === undefined
                          ? "Insufficient shared history"
                          : `+${formatCompactNumber(growth.absoluteGrowth)} · ${growth.percentageGrowth?.toFixed(1)}%`
                      }
                    />
                    <ComparisonMetric
                      icon={GitCommitHorizontal}
                      label="Commits / 90d"
                      value={
                        analysis?.commits90d === null || analysis?.commits90d === undefined
                          ? "Unavailable"
                          : String(analysis.commits90d)
                      }
                      ratio={ratio(analysis?.commits90d, maxCommits)}
                    />
                    <ComparisonMetric
                      label="Active weeks / 12"
                      value={
                        analysis?.activeWeeks12 === null || analysis?.activeWeeks12 === undefined
                          ? "Unavailable"
                          : `${analysis.activeWeeks12}/12`
                      }
                      ratio={
                        analysis?.activeWeeks12 === null || analysis?.activeWeeks12 === undefined
                          ? undefined
                          : analysis.activeWeeks12 / 12
                      }
                    />
                    <ComparisonMetric
                      icon={Users}
                      label="Git authors / 90d"
                      value={
                        analysis?.uniqueAuthors90d === null ||
                        analysis?.uniqueAuthors90d === undefined
                          ? "Unavailable"
                          : String(analysis.uniqueAuthors90d)
                      }
                      ratio={ratio(analysis?.uniqueAuthors90d, maxContributors)}
                    />
                    <ComparisonMetric
                      label="Top author concentration"
                      value={
                        analysis?.topContributorShare === null ||
                        analysis?.topContributorShare === undefined
                          ? "Unavailable"
                          : `${Math.round(Number(analysis.topContributorShare) * 100)}%`
                      }
                    />
                    <ComparisonMetric
                      label="Project age"
                      value={entry.ageDays === null ? "Unavailable" : formatAge(entry.ageDays)}
                    />
                    <ComparisonMetric
                      label="Maturity"
                      value={repository?.maturity?.toLowerCase() ?? "Unavailable"}
                    />
                    <ComparisonMetric
                      label="Momentum"
                      value={
                        repository?.momentum === null || repository?.momentum === undefined
                          ? "Insufficient history"
                          : repository.momentum.toFixed(1)
                      }
                    />
                    <ComparisonMetric label="Freshness" value={entry.freshnessLabel} />
                    <ComparisonMetric
                      icon={Scale}
                      label="Indexed rank"
                      value={
                        repository?.rank
                          ? `#${repository.rank} of ${model.indexedUniverse}`
                          : "Not ranked"
                      }
                    />
                    <ComparisonMetric
                      label="Confidence"
                      value={repository?.scoreConfidence.toLowerCase() ?? "insufficient"}
                    />
                  </article>
                );
              })}
            </div>
            <p className="comparison-footnote">
              Count bars are normalized only against the largest available value in this comparison.
              Score bars retain their published 100/20/15/10-point scales. Missing evidence never
              becomes zero.
            </p>
          </>
        )}
      </section>
    </>
  );
}

function ComparisonMetric({
  label,
  value,
  ratio: normalized,
  icon: Icon,
}: {
  label: string;
  value: string;
  ratio?: number;
  icon?: typeof Star;
}) {
  return (
    <div className="comparison-metric">
      <span>
        {Icon && <Icon size={12} />}
        {label}
      </span>
      <strong>{value}</strong>
      {normalized !== undefined && (
        <i>
          <b style={{ width: `${Math.max(0, Math.min(1, normalized)) * 100}%` }} />
        </i>
      )}
    </div>
  );
}

function maximum(values: Array<number | null | undefined>): number | null {
  const available = values.filter(
    (value): value is number => value !== null && value !== undefined,
  );
  return available.length === 0 ? null : Math.max(...available, 1);
}

function ratio(value: number | null | undefined, maximumValue: number | null): number | undefined {
  return value === null || value === undefined || maximumValue === null
    ? undefined
    : value / maximumValue;
}

function formatAge(days: number): string {
  if (days < 365) return `${days} days`;
  const years = days / 365.25;
  return `${years.toFixed(years >= 10 ? 0 : 1)} years`;
}
