export function formatCompactNumber(value: number | null): string {
  if (value === null) return "Unavailable";
  return new Intl.NumberFormat("en", {
    notation: value >= 1_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000 ? 1 : 0,
  }).format(value);
}

export function formatExactNumber(value: number | null): string {
  if (value === null) return "Unavailable";
  return new Intl.NumberFormat("en").format(value);
}

export function formatPercent(value: number | null): string {
  if (value === null) return "Insufficient history";
  return `${value >= 0 ? "+" : ""}${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(value)}%`;
}

export function formatObservationAge(value: Date | null, now = new Date()): string {
  if (!value) return "Awaiting first observation";
  const seconds = Math.max(0, Math.floor((now.getTime() - value.getTime()) / 1_000));
  if (seconds < 60) return "Updated moments ago";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days}d ago`;
}

export function formatBytes(value: number | null): string {
  if (value === null) return "Unavailable";
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KiB`;
  if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} MiB`;
  return `${(value / 1024 ** 3).toFixed(2)} GiB`;
}
