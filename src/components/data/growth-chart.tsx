type Point = { observedAt: Date; stars: number | null };

export function GrowthChart({ points }: { points: Point[] }) {
  const available = points.filter(
    (point): point is { observedAt: Date; stars: number } => point.stars !== null,
  );
  if (available.length < 2) return null;
  const min = Math.min(...available.map((point) => point.stars));
  const max = Math.max(...available.map((point) => point.stars));
  const range = Math.max(1, max - min);
  const coordinates = available.map((point, index) => ({
    x: 28 + (index / Math.max(1, available.length - 1)) * 744,
    y: 250 - ((point.stars - min) / range) * 200,
    ...point,
  }));
  const path = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ");
  const area = `${path} L${coordinates.at(-1)?.x ?? 0},270 L${coordinates[0]?.x ?? 0},270 Z`;
  return (
    <div className="growth-chart">
      <div className="chart-scale">
        <span>{max.toLocaleString()}</span>
        <span>{min.toLocaleString()}</span>
      </div>
      <svg viewBox="0 0 800 290" role="img" aria-labelledby="growth-title growth-desc">
        <title id="growth-title">Observed star history</title>
        <desc id="growth-desc">{`A line chart of ${available.length} ForgeRank observations from ${formatDate(available[0]?.observedAt)} to ${formatDate(available.at(-1)?.observedAt)}.`}</desc>
        <line x1="28" x2="772" y1="50" y2="50" />
        <line x1="28" x2="772" y1="150" y2="150" />
        <line x1="28" x2="772" y1="250" y2="250" />
        <path className="chart-area" d={area} />
        <path className="chart-line" d={path} />
        {coordinates.map((point) => (
          <circle key={point.observedAt.toISOString()} cx={point.x} cy={point.y} r="4">
            <title>{`${formatDate(point.observedAt)}: ${point.stars.toLocaleString("en-US")} stars`}</title>
          </circle>
        ))}
      </svg>
      <div className="chart-dates">
        <span>{formatDate(available[0]?.observedAt, true)}</span>
        <span>ForgeRank observations</span>
        <span>{formatDate(available.at(-1)?.observedAt, true)}</span>
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
