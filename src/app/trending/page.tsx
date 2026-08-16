import {
  Activity,
  ArrowRight,
  Clock3,
  Flame,
  Gauge,
  Gem,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

import { getDiscoveryRankings } from "@/application/discovery-read-model";
import { DISCOVERY_MODES, type DiscoveryMode } from "@/domain/discovery";
import { RepositoryTable } from "@/components/data/repository-table";
import { InsufficientData } from "@/components/data/empty-state";
import { PageHeader } from "@/components/shell/page-header";

export const dynamic = "force-dynamic";

const modes = [
  ["Trending", "trending", Flame],
  ["Rising", "rising", Gauge],
  ["Breakout", "breakout", Sparkles],
  ["Most improved", "improved", TrendingUp],
  ["Hidden gems", "gems", Gem],
  ["Established", "established", Clock3],
  ["Most active", "active", Activity],
  ["Cooling giants", "cooling", TrendingDown],
] as const;

const periods = [
  ["Today", 1],
  ["This week", 7],
  ["This month", 30],
] as const;

export default async function TrendingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const mode: DiscoveryMode = DISCOVERY_MODES.includes(params.mode as DiscoveryMode)
    ? (params.mode as DiscoveryMode)
    : "trending";
  const period = [1, 7, 30].includes(Number(params.period)) ? Number(params.period) : 7;
  const rankings = await getDiscoveryRankings(mode, period).catch(() => []);
  const repositories = rankings.map((ranking) => ranking.repository);
  const signals = Object.fromEntries(
    rankings.map((ranking) => [
      ranking.repository.id,
      { score: ranking.signalScore, confidence: ranking.confidence },
    ]),
  );
  const confidence = rankings.some((ranking) => ranking.confidence === "HIGH")
    ? "High confidence available"
    : rankings.some((ranking) => ranking.confidence === "MEDIUM")
      ? "Medium confidence"
      : rankings.length > 0
        ? "Limited confidence"
        : "Insufficient history";
  return (
    <>
      <PageHeader
        eyebrow="Signal desk / 7 day"
        title="Open-source momentum"
        description="Velocity, acceleration, engineering activity, and baseline popularity combined with visible confidence. Star count alone never defines this list."
      />
      <section className="shell content-section">
        <nav className="mode-tabs" aria-label="Trending modes">
          {modes.map(([label, value, Icon]) => (
            <Link
              className={mode === value ? "active" : ""}
              key={value}
              href={`/trending?mode=${value}&period=${period}`}
            >
              <Icon size={14} />
              {label}
            </Link>
          ))}
        </nav>
        <nav className="period-tabs" aria-label="Observation period">
          {periods.map(([label, days]) => (
            <Link
              className={period === days ? "active" : ""}
              key={days}
              href={`/trending?mode=${mode}&period=${days}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="confidence-callout">
          <span>Current window</span>
          <strong>{period === 1 ? "1 day" : `${period} days`}</strong>
          <span>Evidence</span>
          <strong>{confidence}</strong>
          <Link href="/methodology#trending">
            Read methodology <ArrowRight size={13} />
          </Link>
        </div>
        {rankings.length > 0 ? (
          <>
            <div className="signal-evidence-grid">
              {rankings.slice(0, 3).map((ranking) => (
                <Link key={ranking.repository.id} href={`/r/${ranking.repository.fullName}`}>
                  <span>{ranking.repository.fullName}</span>
                  <strong>{ranking.signalScore.toFixed(1)} signal</strong>
                  <small>{ranking.evidence.join(" · ")}</small>
                </Link>
              ))}
            </div>
            <RepositoryTable
              repositories={repositories}
              signalLabel="Mode signal"
              signals={signals}
            />
          </>
        ) : (
          <InsufficientData
            title={`${modes.find((entry) => entry[1] === mode)?.[0] ?? "Trend"} is not defensible yet.`}
            detail="This mode has explicit minimum evidence rules. ForgeRank will not substitute current star totals for missing observation history, lifecycle, health, or Git activity."
          />
        )}
      </section>
    </>
  );
}
