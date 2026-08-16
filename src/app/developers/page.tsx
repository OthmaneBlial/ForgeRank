import {
  Activity,
  Filter,
  GitCommitHorizontal,
  Hammer,
  HeartHandshake,
  History,
  Medal,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Wrench,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import {
  getDeveloperLeaderboardReadModel,
  type DeveloperLeaderboardRequest,
} from "@/application/developer-leaderboard-read-model";
import { InsufficientData } from "@/components/data/empty-state";
import { Metric } from "@/components/data/metric";
import { PageHeader } from "@/components/shell/page-header";
import {
  DEVELOPER_ACTIVITY_WINDOWS,
  DEVELOPER_ARCHETYPES,
  DEVELOPER_LEADERBOARD_CATEGORIES,
  type DeveloperActivityWindow,
  type DeveloperArchetype,
  type DeveloperLeaderboardCategory,
  type DeveloperLeaderboardEntry,
} from "@/domain/developer-leaderboard";

export const dynamic = "force-dynamic";

const categories = [
  ["Overall", "overall", Trophy],
  ["Impact", "impact", Medal],
  ["Consistency", "consistency", History],
  ["Collaboration", "collaboration", HeartHandshake],
  ["Builders", "builders", Hammer],
  ["Maintainers", "maintainers", Wrench],
  ["Rising", "rising", Sparkles],
  ["Most active", "active", Activity],
  ["Veterans", "veterans", GitCommitHorizontal],
] as const;

const categoryDescriptions: Record<DeveloperLeaderboardCategory, string> = {
  overall: "The confidence-adjusted, versioned developer-v1 score.",
  impact: "The persisted 25-point impact dimension from observed owned-project reach and quality.",
  consistency: "The persisted 20-point consistency dimension from covered project activity.",
  collaboration:
    "The persisted 20-point collaboration dimension, only with bounded Git-author coverage.",
  builders:
    "The persisted 10-point breadth dimension across indexed owned originals and ecosystems.",
  maintainers:
    "A transparent 55/45 blend of normalized consistency and project-quality dimensions.",
  rising: "Positive score change against a real snapshot at least 30 days earlier.",
  active: "Bounded Git commits across owned projects—not a personal commit total.",
  veterans: "Age of the oldest observed owned original project—not GitHub account age.",
};

type Params = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function signalDisplay(
  entry: DeveloperLeaderboardEntry,
  category: DeveloperLeaderboardCategory,
): string {
  if (category === "veterans")
    return `${(entry.signal / 365.25).toFixed(entry.signal >= 3_652 ? 0 : 1)}y`;
  if (category === "rising") return `+${entry.signal.toFixed(1)}`;
  if (category === "active") return Math.round(entry.signal).toLocaleString("en");
  return `${entry.signal.toFixed(1)}/${entry.signalMaximum}`;
}

function categoryHref(
  category: DeveloperLeaderboardCategory,
  request: DeveloperLeaderboardRequest,
): string {
  const parameters = new URLSearchParams({ category });
  if (request.ecosystem) parameters.set("ecosystem", request.ecosystem);
  if (request.location) parameters.set("location", request.location);
  if (request.activityWindow !== "any") parameters.set("activity", request.activityWindow);
  if (request.archetype !== "all") parameters.set("archetype", request.archetype);
  return `/developers?${parameters.toString()}`;
}

export default async function DevelopersPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const rawCategory = single(params.category);
  const rawActivity = single(params.activity);
  const rawArchetype = single(params.archetype);
  const category: DeveloperLeaderboardCategory = DEVELOPER_LEADERBOARD_CATEGORIES.includes(
    rawCategory as DeveloperLeaderboardCategory,
  )
    ? (rawCategory as DeveloperLeaderboardCategory)
    : "overall";
  const activityWindow: DeveloperActivityWindow = DEVELOPER_ACTIVITY_WINDOWS.includes(
    rawActivity as DeveloperActivityWindow,
  )
    ? (rawActivity as DeveloperActivityWindow)
    : "any";
  const archetype: DeveloperArchetype = DEVELOPER_ARCHETYPES.includes(
    rawArchetype as DeveloperArchetype,
  )
    ? (rawArchetype as DeveloperArchetype)
    : "all";
  const request: DeveloperLeaderboardRequest = {
    category,
    ecosystem: single(params.ecosystem)?.slice(0, 80) || undefined,
    location: single(params.location)?.slice(0, 100) || undefined,
    activityWindow,
    archetype,
  };
  const model = await getDeveloperLeaderboardReadModel(request);
  const activeCategory = categories.find((entry) => entry[1] === category) ?? categories[0];

  return (
    <>
      <PageHeader
        eyebrow="Open-source contributors / indexed evidence"
        title="Developer impact, with boundaries"
        description="Separate leaderboards for impact, consistency, collaboration, project building, maintenance, momentum, activity, and portfolio longevity—never a people-search database."
      />
      <section className="shell content-section">
        <div className="developer-principles">
          <div>
            <GitCommitHorizontal />
            <strong>Git authors stay Git authors</strong>
            <p>No silent identity leap to a public account.</p>
          </div>
          <div>
            <ShieldCheck />
            <strong>Private data stays out</strong>
            <p>No commit emails, phones, or contact harvesting.</p>
          </div>
          <div>
            <Users />
            <strong>Context over vanity</strong>
            <p>Scores describe observed open-source work, not human worth.</p>
          </div>
        </div>

        <nav className="mode-tabs developer-mode-tabs" aria-label="Developer ranking categories">
          {categories.map(([label, value, Icon]) => (
            <Link
              className={category === value ? "active" : ""}
              key={value}
              href={categoryHref(value, request)}
            >
              <Icon size={14} aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>

        <form className="filter-bar developer-filter-bar" method="get">
          <input name="category" type="hidden" value={category} />
          <label>
            <span>Primary ecosystem</span>
            <select name="ecosystem" defaultValue={request.ecosystem ?? ""}>
              <option value="">All observed ecosystems</option>
              {model.options.ecosystems.map((ecosystem) => (
                <option key={ecosystem}>{ecosystem}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Public profile location</span>
            <select name="location" defaultValue={request.location ?? ""}>
              <option value="">All public locations</option>
              {model.options.locations.map((location) => (
                <option key={location}>{location}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Project activity</span>
            <select name="activity" defaultValue={activityWindow}>
              <option value="any">Any evidence state</option>
              <option value="30">Active in 30 days</option>
              <option value="90">Active in 90 days</option>
            </select>
          </label>
          <label>
            <span>Evidence archetype</span>
            <select name="archetype" defaultValue={archetype}>
              <option value="all">All archetypes</option>
              <option value="builder">Builder</option>
              <option value="maintainer">Maintainer</option>
              <option value="collaborator">Collaborator</option>
              <option value="generalist">Generalist</option>
            </select>
          </label>
          <button className="button button-primary" type="submit">
            <Filter size={14} aria-hidden="true" /> Apply
          </button>
        </form>

        <div
          className="coverage-grid developer-coverage"
          aria-label="Developer leaderboard coverage"
        >
          <Metric label="Confirmed profiles" value={String(model.coverage.confirmed)} />
          <Metric label="Scored" value={String(model.coverage.scored)} />
          <Metric label="Owned portfolios" value={String(model.coverage.portfolios)} />
          <Metric label="Git-analyzed" value={String(model.coverage.gitAnalyzed)} />
          <Metric label="30d baselines" value={String(model.coverage.historical)} />
        </div>

        <div className="developer-ranking-context">
          <div>
            <span>Current ranking</span>
            <strong>{activeCategory[0]}</strong>
            <p>{categoryDescriptions[category]}</p>
          </div>
          <div>
            <span>Eligible / confirmed</span>
            <strong>
              {model.entries.length} / {model.coverage.confirmed}
            </strong>
            <p>
              Missing evidence excludes a profile from this category instead of awarding a proxy
              score.
            </p>
          </div>
          <Link href="/methodology#developers">Read the developer methodology</Link>
        </div>

        {model.entries.length > 0 ? (
          <div className="developer-grid developer-leaderboard">
            {model.entries.map((entry) => {
              const { developer } = entry.candidate;
              return (
                <Link key={developer.id} href={`/d/${developer.username}`}>
                  <span>#{entry.position}</span>
                  {developer.avatarUrl ? (
                    <Image
                      className="developer-avatar"
                      src={developer.avatarUrl}
                      alt=""
                      width={38}
                      height={38}
                    />
                  ) : (
                    <span className="developer-avatar developer-avatar-fallback" aria-hidden="true">
                      {developer.username.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="developer-leaderboard-copy">
                    <strong>{developer.displayName ?? developer.username}</strong>
                    <small>
                      @{developer.username} · {developer.scoreConfidence.toLowerCase()} confidence
                    </small>
                    <em>{entry.evidence}</em>
                  </div>
                  <div className="developer-signal">
                    <b>{signalDisplay(entry, category)}</b>
                    <small>{entry.signalLabel}</small>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <InsufficientData
            title={`No profiles meet the ${activeCategory[0]} evidence rules.`}
            detail="This category and its filters require specific observed portfolio, Git, or historical evidence. ForgeRank will not substitute profile popularity, account metadata, or inferred identity for a missing signal."
          />
        )}

        <div className="developer-boundary-note">
          <ShieldCheck size={18} aria-hidden="true" />
          <p>
            Location is included only when the confirmed public profile exposes it. Account-age
            filtering is withheld because the current parser does not collect a dependable join
            date; Veterans ranks observed project longevity instead. Every denominator is
            ForgeRank&apos;s indexed universe, not all GitHub users.
          </p>
        </div>
      </section>
    </>
  );
}
