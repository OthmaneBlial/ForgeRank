import Link from "next/link";

import { formatCompactNumber, formatExactNumber } from "@/domain/format";
import type { MomentumMatrixPoint } from "@/domain/momentum-matrix";
import type { RepositoryListItem } from "@/domain/repository";

type MomentumMatrixProps = {
  repositories?: RepositoryListItem[];
  points?: MomentumMatrixPoint[];
  showLegend?: boolean;
};

const MAX_PLOTTED_POINTS = 28;

export function MomentumMatrix(props: MomentumMatrixProps) {
  const sourcePoints =
    props.points ??
    (props.repositories ?? []).map((repository) => ({
      repository,
      growth30d: null,
      growthConfidence: "INSUFFICIENT" as const,
      historySpanDays: 0,
      ageDays: null,
      topicSlugs: [],
    }));
  const points = sourcePoints
    .filter((point) => point.repository.stars !== null && point.repository.momentum !== null)
    .slice(0, MAX_PLOTTED_POINTS);

  if (points.length < 3) return null;

  const maxStars = Math.max(...points.map((point) => point.repository.stars ?? 1), 10);

  return (
    <div className="momentum-matrix">
      <div className="matrix-chart">
        <div className="matrix-label matrix-label-top">Momentum / 0–100</div>
        <div className="matrix-quadrants" aria-hidden="true">
          <span>Breakouts</span>
          <span>Leaders</span>
          <span>Hidden gems</span>
          <span>Cooling giants</span>
        </div>
        <svg viewBox="0 0 800 420" role="group" aria-labelledby="matrix-title matrix-description">
          <title id="matrix-title">Repository momentum matrix</title>
          <desc id="matrix-description">
            Indexed repositories plotted by logarithmic observed star count and momentum from zero
            to one hundred. Each point links to its repository detail page.
          </desc>
          <line x1="400" x2="400" y1="24" y2="390" />
          <line x1="38" x2="770" y1="207" y2="207" />
          {points.map((point, index) => {
            const { repository } = point;
            const x =
              45 + (Math.log10((repository.stars ?? 0) + 1) / Math.log10(maxStars + 1)) * 710;
            const y = 382 - (clamp(repository.momentum ?? 0, 0, 100) / 100) * 345;
            const radius = 5 + Math.min(8, Math.sqrt(repository.score ?? 0) * 0.55);
            const details = pointDescription(point);
            return (
              <Link key={repository.id} href={`/r/${repository.fullName}`} aria-label={details}>
                <circle cx={x} cy={y} r={18} className="matrix-hit-target" />
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  className={`matrix-point-visible ${index < 4 ? "matrix-point-hot" : "matrix-point"}`}
                >
                  <title>{details}</title>
                </circle>
              </Link>
            );
          })}
        </svg>
      </div>
      <div className="matrix-axis">
        <span>Lower visibility</span>
        <span>Observed stars / logarithmic</span>
        <span>Higher visibility</span>
      </div>
      {props.showLegend ? (
        <div className="matrix-point-list" aria-label="Plotted repository evidence">
          {points.map((point) => (
            <Link key={point.repository.id} href={`/r/${point.repository.fullName}`}>
              <strong>{point.repository.fullName}</strong>
              <span>
                <small>Stars</small>
                {formatCompactNumber(point.repository.stars)}
              </span>
              <span>
                <small>30d growth</small>
                {formatGrowth(point.growth30d)}
              </span>
              <span>
                <small>ForgeRank</small>
                {formatMetric(point.repository.score)}
              </span>
              <span>
                <small>Momentum</small>
                {formatMetric(point.repository.momentum)}
              </span>
              <em>
                {point.growth30d === null
                  ? "30d evidence unavailable"
                  : `${point.growthConfidence.toLocaleLowerCase()} confidence · ${formatSpan(point.historySpanDays)} observed span`}
              </em>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function pointDescription(point: MomentumMatrixPoint): string {
  const growth =
    point.growth30d === null
      ? "30-day growth unavailable"
      : `30-day window growth ${formatGrowth(point.growth30d)}, ${point.growthConfidence.toLocaleLowerCase()} confidence over a ${formatSpan(point.historySpanDays)} observed span`;
  return `${point.repository.fullName}: ${formatExactNumber(point.repository.stars)} observed stars; ${growth}; ForgeRank score ${formatMetric(point.repository.score)}; momentum ${formatMetric(point.repository.momentum)}`;
}

function formatGrowth(value: number | null): string {
  if (value === null) return "Unavailable";
  return `${value >= 0 ? "+" : ""}${formatExactNumber(value)}`;
}

function formatMetric(value: number | null): string {
  if (value === null) return "Unavailable";
  return new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value);
}

function formatSpan(value: number): string {
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value)}d`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
