import {
  Activity,
  ArrowLeft,
  CircleGauge,
  Database,
  GitCommitHorizontal,
  HeartPulse,
  Scale,
  Star,
  Users,
} from "lucide-react";
import Link from "next/link";

import { getEcosystemComparisonReadModel } from "@/application/comparison-read-model";
import { InsufficientData } from "@/components/data/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { formatCompactNumber } from "@/domain/format";

export const dynamic = "force-dynamic";

export default async function EcosystemComparisonResultPage({
  params,
}: {
  params: Promise<{ ecosystems: string[] }>;
}) {
  const resolved = await params;
  const raw = resolved.ecosystems.map((segment) => decodeURIComponent(segment)).join("/");
  const model = await getEcosystemComparisonReadModel(raw.split(","));
  const maxRepositories = maximum(model.entries.map((entry) => entry.repositoryCount));
  const maxStars = maximum(
    model.entries.map((entry) => (entry.repositoryCount > 0 ? entry.totalStars : null)),
  );
  const maxCommits = maximum(model.entries.map((entry) => entry.totalCommits90d));
  const maxAuthors = maximum(model.entries.map((entry) => entry.averageAuthors90d));
  return (
    <>
      <PageHeader
        eyebrow="Comparison / ecosystem battle"
        title={
          model.entries.length >= 2
            ? model.entries.map((entry) => entry.name).join(" vs ")
            : "Choose at least two ecosystems"
        }
        description="Primary-language cohorts measured inside ForgeRank's currently observed repository dataset."
      />
      <section className="shell content-section">
        <Link className="back-link" href="/compare/ecosystems">
          <ArrowLeft size={14} /> Change ecosystems
        </Link>
        {model.entries.length < 2 ? (
          <InsufficientData
            title="An ecosystem comparison needs two cohorts."
            detail="Choose two to five indexed primary languages to create a shareable comparison."
          />
        ) : (
          <>
            <div className="comparison-window comparison-window-ready">
              <Database size={18} />
              <div>
                <strong>Indexed dataset boundary</strong>
                <p>
                  Aggregates include observed repositories whose primary language matches the
                  selected cohort. They do not estimate all repositories on GitHub.
                </p>
              </div>
              <span>
                {model.indexedUniverse} observed repositories · calculated{" "}
                {model.calculatedAt.toLocaleDateString("en")}
              </span>
            </div>
            <div className="comparison-grid ecosystem-comparison-grid">
              {model.entries.map((entry) => (
                <article key={entry.name} className="comparison-column">
                  <div className="comparison-column-head">
                    <span>Primary-language cohort</span>
                    <h2>{entry.name}</h2>
                    <p>
                      {entry.repositoryCount === 0
                        ? "No matching observed repositories are currently available."
                        : `${entry.repositoryCount} observed repositor${entry.repositoryCount === 1 ? "y" : "ies"}; ${entry.scoredRepositoryCount} scored and ${entry.gitAnalyzedRepositoryCount} Git-analyzed.`}
                    </p>
                    {entry.topRepositories.length > 0 && (
                      <div className="ecosystem-projects">
                        {entry.topRepositories.map((repository) => {
                          const [owner, name] = repository.fullName.split("/");
                          return (
                            <Link key={repository.id} href={`/r/${owner}/${name}`}>
                              {repository.fullName}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <EcosystemMetric
                    icon={Database}
                    label="Repositories indexed"
                    value={String(entry.repositoryCount)}
                    ratio={ratio(entry.repositoryCount, maxRepositories)}
                  />
                  <EcosystemMetric
                    icon={Star}
                    label="Total observed stars"
                    value={
                      entry.repositoryCount === 0
                        ? "Unavailable"
                        : formatCompactNumber(entry.totalStars)
                    }
                    ratio={
                      entry.repositoryCount === 0 ? undefined : ratio(entry.totalStars, maxStars)
                    }
                  />
                  <EcosystemMetric
                    icon={CircleGauge}
                    label="Average ForgeRank"
                    value={score(entry.averageScore, 100)}
                    ratio={publishedRatio(entry.averageScore, 100)}
                  />
                  <EcosystemMetric
                    icon={HeartPulse}
                    label="Average health"
                    value={score(entry.averageHealth, 20)}
                    ratio={publishedRatio(entry.averageHealth, 20)}
                  />
                  <EcosystemMetric
                    label="Average community"
                    value={score(entry.averageCommunity, 15)}
                    ratio={publishedRatio(entry.averageCommunity, 15)}
                  />
                  <EcosystemMetric
                    label="Average engineering"
                    value={score(entry.averageEngineering, 10)}
                    ratio={publishedRatio(entry.averageEngineering, 10)}
                  />
                  <EcosystemMetric
                    icon={Activity}
                    label="Average momentum"
                    value={score(entry.averageMomentum, 20)}
                    ratio={publishedRatio(entry.averageMomentum, 20)}
                  />
                  <EcosystemMetric
                    label="Active repositories / 90d"
                    value={
                      entry.gitAnalyzedRepositoryCount === 0
                        ? "Unavailable"
                        : `${entry.activeRepositoryCount} of ${entry.gitAnalyzedRepositoryCount} analyzed`
                    }
                    ratio={
                      entry.gitAnalyzedRepositoryCount === 0
                        ? undefined
                        : entry.activeRepositoryCount / entry.gitAnalyzedRepositoryCount
                    }
                  />
                  <EcosystemMetric
                    icon={GitCommitHorizontal}
                    label="Commits / 90d"
                    value={
                      entry.totalCommits90d === null
                        ? "Unavailable"
                        : formatCompactNumber(entry.totalCommits90d)
                    }
                    ratio={ratio(entry.totalCommits90d, maxCommits)}
                  />
                  <EcosystemMetric
                    label="Average active weeks / 12"
                    value={score(entry.averageActiveWeeks12, 12)}
                    ratio={publishedRatio(entry.averageActiveWeeks12, 12)}
                  />
                  <EcosystemMetric
                    icon={Users}
                    label="Average Git authors / 90d"
                    value={
                      entry.averageAuthors90d === null
                        ? "Unavailable"
                        : entry.averageAuthors90d.toFixed(1)
                    }
                    ratio={ratio(entry.averageAuthors90d, maxAuthors)}
                  />
                  <EcosystemMetric
                    icon={Scale}
                    label="Score coverage"
                    value={`${entry.scoredRepositoryCount} of ${entry.repositoryCount} repositories`}
                    ratio={
                      entry.repositoryCount === 0
                        ? undefined
                        : entry.scoredRepositoryCount / entry.repositoryCount
                    }
                  />
                  <EcosystemMetric
                    label="Git analysis coverage"
                    value={`${entry.gitAnalyzedRepositoryCount} of ${entry.repositoryCount} repositories`}
                    ratio={
                      entry.repositoryCount === 0
                        ? undefined
                        : entry.gitAnalyzedRepositoryCount / entry.repositoryCount
                    }
                  />
                </article>
              ))}
            </div>
            <p className="comparison-footnote">
              Repository, star, commit, and author bars are normalized against the largest available
              cohort in this comparison. ForgeRank, health, community, engineering, momentum, and
              active-week bars retain their published scales. Averages omit missing values and
              coverage rows expose the denominator.
            </p>
          </>
        )}
      </section>
    </>
  );
}

function EcosystemMetric({
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

function publishedRatio(value: number | null, maximumValue: number): number | undefined {
  return value === null ? undefined : value / maximumValue;
}

function score(value: number | null, maximumValue: number): string {
  return value === null ? "Unavailable" : `${value.toFixed(1)}/${maximumValue}`;
}
