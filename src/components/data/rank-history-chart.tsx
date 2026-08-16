import type { RankHistoryPoint } from "@/domain/ranking-history";

export function RankHistoryChart({ points }: { points: RankHistoryPoint[] }) {
  const ordered = points.toSorted(
    (left, right) => left.calculatedAt.getTime() - right.calculatedAt.getTime(),
  );
  if (ordered.length < 2) return null;

  const bestRank = Math.min(...ordered.map((point) => point.rank));
  const worstRank = Math.max(...ordered.map((point) => point.rank));
  const rankRange = Math.max(1, worstRank - bestRank);
  const firstAt = ordered[0]?.calculatedAt.getTime() ?? 0;
  const lastAt = ordered.at(-1)?.calculatedAt.getTime() ?? firstAt;
  const timeRange = Math.max(1, lastAt - firstAt);
  const coordinates = ordered.map((point) => ({
    ...point,
    x: 42 + ((point.calculatedAt.getTime() - firstAt) / timeRange) * 718,
    y: 48 + ((point.rank - bestRank) / rankRange) * 198,
  }));
  const path = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");

  return (
    <div className="rank-history-chart">
      <div className="rank-chart-scale">
        <span>#{bestRank}</span>
        <span>#{worstRank}</span>
      </div>
      <svg viewBox="0 0 800 280" role="img" aria-labelledby="rank-chart-title rank-chart-desc">
        <title id="rank-chart-title">Global rank history</title>
        <desc id="rank-chart-desc">
          {`${ordered.length} completed ForgeRank ranking observations from ${formatDate(ordered[0]?.calculatedAt)} to ${formatDate(ordered.at(-1)?.calculatedAt)}. A lower rank number is better.`}
        </desc>
        <line x1="42" x2="760" y1="48" y2="48" />
        <line x1="42" x2="760" y1="147" y2="147" />
        <line x1="42" x2="760" y1="246" y2="246" />
        <path className="rank-chart-line" d={path} />
        {coordinates.map((point) => (
          <circle
            key={`${point.calculatedAt.toISOString()}:${point.rank}`}
            cx={point.x}
            cy={point.y}
            r="5"
          >
            <title>{`${formatDate(point.calculatedAt)}: rank #${point.rank}, score ${point.score.toFixed(1)}`}</title>
          </circle>
        ))}
      </svg>
      <div className="chart-dates">
        <span>{formatDate(ordered[0]?.calculatedAt, true)}</span>
        <span>Completed global rankings · UTC</span>
        <span>{formatDate(ordered.at(-1)?.calculatedAt, true)}</span>
      </div>
    </div>
  );
}

function formatDate(value: Date | undefined, short = false): string {
  if (!value) return "unavailable";
  return new Intl.DateTimeFormat(
    "en-US",
    short
      ? { month: "short", day: "numeric", timeZone: "UTC" }
      : { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" },
  ).format(value);
}
