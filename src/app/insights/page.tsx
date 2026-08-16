import { Filter, RotateCcw } from "lucide-react";
import Link from "next/link";

import { getMomentumMatrixReadModel } from "@/application/momentum-matrix-read-model";
import { InsufficientData } from "@/components/data/empty-state";
import { MomentumMatrix } from "@/components/data/momentum-matrix";
import { PageHeader } from "@/components/shell/page-header";
import {
  MOMENTUM_MATRIX_AGE_FILTERS,
  type MomentumMatrixAgeFilter,
} from "@/domain/momentum-matrix";

export const dynamic = "force-dynamic";

type Params = Promise<Record<string, string | string[] | undefined>>;

const ageLabels: Record<MomentumMatrixAgeFilter, string> = {
  all: "Any observed age",
  new: "New / under 90 days",
  "under-1": "Under 1 year",
  "1-3": "1–3 years",
  "3-5": "3–5 years",
  "5-plus": "5 years or older",
};

export default async function InsightsPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const filters = {
    language: safeLanguage(params.language),
    topic: safeTopic(params.topic),
    age: safeAge(params.age),
    minimumStars: safeMinimumStars(params.stars),
  };
  let model: Awaited<ReturnType<typeof getMomentumMatrixReadModel>> | null = null;
  try {
    model = await getMomentumMatrixReadModel(filters);
  } catch {
    model = null;
  }

  const plotted = Math.min(model?.coverage.filtered ?? 0, 28);
  const growthAvailable = model?.coverage.growthAvailable ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Insights / momentum matrix"
        title="Popularity is only one axis"
        description="Filter ForgeRank's indexed repositories by language, topic, age, and observed stars. Every point combines observed popularity with versioned momentum; missing history remains unavailable."
      />
      <section className="shell content-section matrix-workbench">
        <form className="filter-bar matrix-filter-bar" method="get">
          <label>
            <span>Language</span>
            <select name="language" defaultValue={filters.language ?? ""}>
              <option value="">All observed languages</option>
              {model?.options.languages.map((language) => (
                <option key={language}>{language}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Topic</span>
            <select name="topic" defaultValue={filters.topic ?? ""}>
              <option value="">All classified topics</option>
              {model?.options.topics.map((topic) => (
                <option key={topic.slug} value={topic.slug}>
                  {topic.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Repository age</span>
            <select name="age" defaultValue={filters.age}>
              {MOMENTUM_MATRIX_AGE_FILTERS.map((age) => (
                <option key={age} value={age}>
                  {ageLabels[age]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Minimum observed stars</span>
            <input
              name="stars"
              type="number"
              min="0"
              max="1000000000"
              step="100"
              defaultValue={filters.minimumStars}
            />
          </label>
          <div className="matrix-filter-actions">
            <button className="button button-primary" type="submit">
              <Filter size={14} aria-hidden="true" /> Apply
            </button>
            <Link className="button button-secondary" href="/insights">
              <RotateCcw size={13} aria-hidden="true" /> Reset
            </Link>
          </div>
        </form>

        <div className="matrix-coverage-strip" aria-label="Momentum Matrix coverage">
          <CoverageMetric label="Plotted" value={String(plotted)} />
          <CoverageMetric
            label="Momentum eligible"
            value={String(model?.coverage.momentumEligible ?? 0)}
          />
          <CoverageMetric
            label="30d growth evidence"
            value={`${growthAvailable} / ${model?.coverage.filtered ?? 0}`}
          />
          <CoverageMetric
            label="Indexed denominator"
            value={`${model?.coverage.indexed ?? 0} / ${model?.coverage.identifiers ?? 0}`}
          />
        </div>

        {model && plotted >= 3 ? (
          <>
            <MomentumMatrix points={model.points} showLegend />
            <div className="matrix-boundary-note">
              <p>
                The chart plots at most 28 filtered repositories from a bounded 100-repository read.
                Popularity uses a logarithmic star axis; momentum uses the versioned 0–100 signal.
                Growth compares real snapshots without interpolation.
              </p>
              <Link href="/methodology#trending">Read the momentum methodology</Link>
            </div>
          </>
        ) : (
          <InsufficientData
            action={false}
            title={model ? "Not enough comparable repositories." : "Matrix data is unavailable."}
            detail={
              model
                ? `The current filters leave ${model.coverage.filtered} momentum-eligible ${model.coverage.filtered === 1 ? "repository" : "repositories"}. The matrix activates at three; broaden a filter without reconstructing missing evidence.`
                : "ForgeRank could not read the local index. No matrix values have been substituted or reconstructed."
            }
          />
        )}
      </section>
    </>
  );
}

function CoverageMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function safeLanguage(value: string | string[] | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().slice(0, 40);
  return normalized && /^[a-z0-9+#. _-]+$/i.test(normalized) ? normalized : undefined;
}

function safeTopic(value: string | string[] | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLocaleLowerCase().slice(0, 60);
  return normalized && /^[a-z0-9-]+$/.test(normalized) ? normalized : undefined;
}

function safeAge(value: string | string[] | undefined): MomentumMatrixAgeFilter {
  return MOMENTUM_MATRIX_AGE_FILTERS.find((candidate) => candidate === value) ?? "all";
}

function safeMinimumStars(value: string | string[] | undefined): number {
  if (typeof value !== "string" || value.trim() === "") return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(1_000_000_000, Math.max(0, Math.floor(parsed)));
}
