import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  CircleGauge,
  Download,
  GitCommitHorizontal,
  GitFork,
  Scale,
  ShieldCheck,
  Star,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { getRepositoryDetailReadModel } from "@/application/read-model";
import { GrowthChart } from "@/components/data/growth-chart";
import { InsufficientData } from "@/components/data/empty-state";
import { Metric } from "@/components/data/metric";
import { RankHistoryChart } from "@/components/data/rank-history-chart";
import { WatchButton } from "@/components/data/watch-button";
import { RepositoryFreshness } from "@/components/data/repository-freshness";
import { formatBytes, formatCompactNumber, formatExactNumber } from "@/domain/format";
import { summarizeRankMovementWindows } from "@/domain/ranking-history";
import type { RepositoryScoreReasonTone } from "@/domain/repository";
import { REPOSITORY_EVENT_VERSION, type RepositoryEventKind } from "@/domain/repository-events";
import { deriveRepositorySignals, REPOSITORY_SIGNAL_VERSION } from "@/domain/repository-signals";

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ owner: string; repo: string }>;

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const { owner, repo } = await params;
  return {
    title: `${repo} GitHub analytics, growth & ranking`,
    description: `Transparent public-signal analytics for ${owner}/${repo}, based on ForgeRank's indexed universe.`,
  };
}

export default async function RepositoryDetailPage({ params }: { params: RouteParams }) {
  const { owner, repo } = await params;
  const model = await getRepositoryDetailReadModel(owner, repo);
  if (!model) return <UnknownRepository owner={owner} repo={repo} />;
  const { repository, snapshots } = model;
  const {
    gitAnalysis,
    contributors,
    topicClassifications,
    similarRepositories,
    rankHistory,
    repositoryEvents,
  } = model;
  const latest = snapshots.at(-1);
  const previous = snapshots.length > 1 ? snapshots.at(-2) : null;
  const observedGrowth =
    latest?.stars !== null &&
    latest?.stars !== undefined &&
    previous?.stars !== null &&
    previous?.stars !== undefined
      ? Math.max(0, latest.stars - previous.stars)
      : null;
  const rankMovementWindows = summarizeRankMovementWindows(rankHistory);
  const projectSignals = deriveRepositorySignals({
    maturity: repository.maturity,
    momentum: repository.momentum,
    snapshotCount: snapshots.length,
    activeWeeks12: gitAnalysis?.activeWeeks12 ?? null,
    latestCommitAt: gitAnalysis?.latestCommitAt ?? null,
    uniqueAuthors90d: gitAnalysis?.uniqueAuthors90d ?? null,
    topContributorShare:
      gitAnalysis?.topContributorShare === null || gitAnalysis?.topContributorShare === undefined
        ? null
        : Number(gitAnalysis.topContributorShare),
    tagCount: gitAnalysis?.tagCount ?? null,
    qualitySignals: gitAnalysis?.qualitySignals ?? null,
  });
  return (
    <>
      <header className="repository-hero shell">
        <div className="repo-breadcrumb">
          <Link href="/repositories">Repositories</Link>
          <span>/</span>
          <span>{repository.primaryLanguage ?? "Unclassified"}</span>
        </div>
        <div className="repo-title-row">
          <div>
            <p className="repo-owner">{repository.owner}</p>
            <h1>{repository.name}</h1>
            <p className="repo-description">
              {repository.description ?? "Public repository metadata has not been observed yet."}
            </p>
          </div>
          <div className="repo-actions">
            <a
              className="button button-secondary"
              href={`https://github.com/${repository.fullName}`}
              target="_blank"
              rel="noreferrer"
            >
              Source page <ArrowUpRight size={14} />
            </a>
            <Link
              className="button button-secondary"
              href={`/compare/${repository.fullName.replace("/", ",")}`}
            >
              Compare
            </Link>
            <a
              className="button button-secondary"
              href={`/api/export/repository/${repository.owner}/${repository.name}`}
              download
            >
              <Download size={14} /> Export
            </a>
            <WatchButton fullName={repository.fullName} />
          </div>
        </div>
        <div className="repo-meta-line">
          <span className="status-pill">
            <i />
            {repository.state.toLowerCase()}
          </span>
          <span>{repository.primaryLanguage ?? "Language unavailable"}</span>
          <span>
            {repository.maturity ? repository.maturity.toLowerCase() : "Maturity pending"}
          </span>
        </div>
        <RepositoryFreshness
          owner={repository.owner}
          name={repository.name}
          updatedLabel={model.freshnessLabel}
          refreshTier={repository.refreshTier}
        />
        <div className="repo-metric-grid">
          <Metric
            label="Stars"
            value={formatCompactNumber(repository.stars)}
            detail={repository.stars === null ? undefined : formatExactNumber(repository.stars)}
            icon={Star}
          />
          <Metric label="Forks" value={formatCompactNumber(repository.forks)} icon={GitFork} />
          <Metric
            label="Observed change"
            value={
              observedGrowth === null
                ? "Insufficient history"
                : `+${formatCompactNumber(observedGrowth)}`
            }
            icon={Activity}
          />
          <Metric
            label="Last activity"
            value={
              repository.lastActivityAt
                ? repository.lastActivityAt.toLocaleDateString("en", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Unavailable"
            }
            detail={
              repository.lastActivityAt
                ? "Derived from bounded Git history"
                : "Git inspection pending"
            }
            icon={GitCommitHorizontal}
          />
          <Metric
            label="Contributors"
            value={
              gitAnalysis?.uniqueAuthors90d === null || gitAnalysis?.uniqueAuthors90d === undefined
                ? "Unavailable"
                : String(gitAnalysis.uniqueAuthors90d)
            }
            detail="Git authors, not inferred accounts"
            icon={Users}
          />
          <Metric
            label="ForgeRank"
            value={repository.score === null ? "Not scored" : `${Math.round(repository.score)}/100`}
            detail={`${repository.scoreConfidence.toLowerCase()} confidence`}
            icon={CircleGauge}
          />
        </div>
      </header>

      <nav className="detail-tabs">
        <div className="shell">
          <a href="#overview">Overview</a>
          <a href="#growth">Growth</a>
          <a href="#activity">Activity</a>
          <a href="#signals">Signals</a>
          <a href="#community">Community</a>
          <a href="#technology">Technology</a>
          <a href="#similar">Similar</a>
          <a href="#rankings">Rankings</a>
          <a href="#timeline">Timeline</a>
          <a href="#history">History</a>
        </div>
      </nav>

      <div className="shell detail-layout">
        <main className="detail-main">
          <section id="overview" className="detail-section">
            <div className="detail-section-heading">
              <p className="eyebrow">Score / versioned methodology</p>
              <h2>Why this score?</h2>
            </div>
            {latest?.forgeScore !== null && latest?.forgeScore !== undefined ? (
              <div className="score-explainer">
                <div className="score-total">
                  <span>ForgeRank</span>
                  <strong>{Number(latest.forgeScore).toFixed(0)}</strong>
                  <small>/ 100</small>
                </div>
                <div className="score-bars">
                  <ScoreBar label="Impact" value={latest.impactScore} maximum={25} />
                  <ScoreBar label="Momentum" value={latest.momentumScore} maximum={20} />
                  <ScoreBar label="Health" value={latest.healthScore} maximum={20} />
                  <ScoreBar label="Community" value={latest.communityScore} maximum={15} />
                  <ScoreBar label="Engineering" value={latest.engineeringScore} maximum={10} />
                  <ScoreBar label="Trust" value={latest.trustScore} maximum={10} />
                </div>
                <div className="score-reasons">
                  <div className="score-reasons-heading">
                    <div>
                      <p className="eyebrow">Dimension-level evidence</p>
                      <h3>Observed reasons</h3>
                    </div>
                    <p>
                      Evidence observed{" "}
                      <time dateTime={latest.observedAt.toISOString()}>
                        {latest.observedAt.toLocaleString("en")}
                      </time>
                    </p>
                  </div>
                  {latest.scoreReasons.length > 0 ? (
                    <ul>
                      {latest.scoreReasons.map((reason) => (
                        <li
                          className={`score-reason score-reason-${reason.tone.toLowerCase()}`}
                          key={reason.dimension}
                        >
                          <span className="score-reason-tone">{formatReasonTone(reason.tone)}</span>
                          <div>
                            <small>{reason.dimension}</small>
                            <strong>{reason.summary}</strong>
                            <p>{reason.detail}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="score-reasons-pending">
                      Dimension evidence is awaiting the next versioned score calculation.
                    </p>
                  )}
                </div>
                <div className="score-note">
                  <ShieldCheck size={18} />
                  <p>
                    These are calculation inputs, not verdicts. Missing fields contribute nothing,
                    and limited confidence reduces the total.
                  </p>
                  <Link href="/methodology">Full formula</Link>
                </div>
              </div>
            ) : (
              <InsufficientData detail="A repository score is computed only after a validated public observation. No score is inferred from its identifier." />
            )}
          </section>
          <section id="growth" className="detail-section">
            <div className="detail-section-heading">
              <p className="eyebrow">Observed history / append only</p>
              <h2>Growth</h2>
              <p>ForgeRank&apos;s own snapshots—not reconstructed historical estimates.</p>
            </div>
            <GrowthChart
              points={snapshots.map((snapshot) => ({
                observedAt: snapshot.observedAt,
                stars: snapshot.stars,
              }))}
            />
            {snapshots.filter((snapshot) => snapshot.stars !== null).length < 2 && (
              <InsufficientData
                action={false}
                detail={`ForgeRank has ${snapshots.length} snapshot${snapshots.length === 1 ? "" : "s"} for this repository. A growth line requires at least two.`}
              />
            )}
          </section>
          <section id="activity" className="detail-section">
            <div className="detail-section-heading">
              <p className="eyebrow">Engineering / Git-derived</p>
              <h2>Activity</h2>
              <p>
                Activity signals describe maintenance cadence. Raw commit volume is not treated as
                developer or code quality.
              </p>
            </div>
            {gitAnalysis ? (
              <>
                <div className="activity-grid">
                  <Metric
                    label="Commits / 30d"
                    value={
                      gitAnalysis.commits30d === null
                        ? "Unavailable"
                        : String(gitAnalysis.commits30d)
                    }
                  />
                  <Metric
                    label="Commits / 90d"
                    value={
                      gitAnalysis.commits90d === null
                        ? "Unavailable"
                        : String(gitAnalysis.commits90d)
                    }
                  />
                  <Metric
                    label="Active weeks / 12"
                    value={
                      gitAnalysis.activeWeeks12 === null
                        ? "Unavailable"
                        : `${gitAnalysis.activeWeeks12}/12`
                    }
                  />
                  <Metric
                    label="Known tags"
                    value={
                      gitAnalysis.tagCount === null
                        ? "Unavailable"
                        : formatExactNumber(gitAnalysis.tagCount)
                    }
                  />
                </div>
                <div className="analysis-context">
                  <span>Analysis strategy</span>
                  <strong>{gitAnalysis.strategy}</strong>
                  <span>Version</span>
                  <strong>{gitAnalysis.analysisVersion}</strong>
                  <span>Analyzed</span>
                  <strong>{gitAnalysis.analyzedAt.toLocaleString("en")}</strong>
                </div>
              </>
            ) : (
              <InsufficientData
                action={false}
                detail="Commit cadence, active weeks, tags, and contributor concentration appear after bounded Git history inspection completes."
              />
            )}
          </section>
          <section id="signals" className="detail-section">
            <div className="detail-section-heading">
              <p className="eyebrow">Deterministic observations / {REPOSITORY_SIGNAL_VERSION}</p>
              <h2>ForgeRank signals</h2>
              <p>
                Human-readable rules summarize observed evidence. They are context, not predictions
                or verdicts about project quality, security, or maintainer intent.
              </p>
            </div>
            {projectSignals.length > 0 ? (
              <div className="project-signal-grid">
                {projectSignals.map((signal, index) => (
                  <article
                    key={signal.key}
                    className={"project-signal project-signal-" + signal.tone.toLowerCase()}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <small>{signal.title}</small>
                      <strong>{signal.status}</strong>
                      <p>{signal.detail}</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <InsufficientData
                action={false}
                detail="ForgeRank Signals appear only after bounded Git analysis or multiple persisted observations provide a deterministic rule input."
              />
            )}
            <p className="project-signal-method">
              Definitions are versioned and documented in{" "}
              <Link href="/methodology">Methodology</Link>. Missing evidence produces no signal.
            </p>
          </section>
          <section id="community" className="detail-section">
            <div className="detail-section-heading">
              <p className="eyebrow">Contributors / privacy-safe</p>
              <h2>Community structure</h2>
              <p>
                These are Git authors observed in bounded history, not confirmed public accounts.
                Commit email addresses are not displayed.
              </p>
            </div>
            {gitAnalysis && contributors.length > 0 ? (
              <>
                <div className="community-summary">
                  <Dna
                    label="Unique authors / 90d"
                    value={String(gitAnalysis.uniqueAuthors90d ?? "Unavailable")}
                  />
                  <Dna
                    label="Top author share"
                    value={
                      gitAnalysis.topContributorShare === null
                        ? "Unavailable"
                        : `${Math.round(Number(gitAnalysis.topContributorShare) * 100)}%`
                    }
                  />
                  <Dna
                    label="Top 3 share"
                    value={
                      gitAnalysis.topThreeContributorShare === null
                        ? "Unavailable"
                        : `${Math.round(Number(gitAnalysis.topThreeContributorShare) * 100)}%`
                    }
                  />
                </div>
                <div
                  className="contributor-list"
                  role="table"
                  aria-label="Git authors observed in bounded repository history"
                >
                  <div role="row">
                    <strong role="columnheader">Git author</strong>
                    <strong role="columnheader">Commits / observed window</strong>
                    <strong role="columnheader">Last observed commit</strong>
                  </div>
                  {contributors.map((contributor) => (
                    <div role="row" key={contributor.contributorKey}>
                      <span role="cell">
                        <i />
                        {contributor.displayName}
                        <small>Git author</small>
                      </span>
                      <strong role="cell">{contributor.commits}</strong>
                      <span role="cell">
                        {contributor.lastCommitAt?.toLocaleDateString("en") ?? "Unavailable"}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <InsufficientData
                action={false}
                detail="ForgeRank reports Git authors separately from confirmed public accounts and never displays commit email addresses."
              />
            )}
          </section>
          <section id="technology" className="detail-section">
            <div className="detail-section-heading">
              <p className="eyebrow">Project DNA / deterministic</p>
              <h2>Technology & signals</h2>
            </div>
            <div className="dna-grid">
              <Dna label="Primary language" value={repository.primaryLanguage ?? "Unavailable"} />
              <Dna
                label="Maturity"
                value={repository.maturity?.toLowerCase() ?? "Insufficient evidence"}
              />
              <Dna
                label="Activity"
                value={
                  gitAnalysis?.activeWeeks12 === null || gitAnalysis?.activeWeeks12 === undefined
                    ? "Inspection pending"
                    : gitAnalysis.activeWeeks12 >= 8
                      ? "High"
                      : gitAnalysis.activeWeeks12 >= 4
                        ? "Steady"
                        : "Light"
                }
              />
              <Dna
                label="Community"
                value={
                  gitAnalysis?.topContributorShare === null ||
                  gitAnalysis?.topContributorShare === undefined
                    ? "Inspection pending"
                    : Number(gitAnalysis.topContributorShare) < 0.5
                      ? "Distributed"
                      : "Concentrated"
                }
              />
              <Dna
                label="Momentum"
                value={
                  repository.momentum === null
                    ? "Insufficient history"
                    : repository.momentum.toFixed(1)
                }
              />
              <Dna label="Project type" value={topicClassifications[0]?.name ?? "Unclassified"} />
            </div>
            {topicClassifications.length > 0 && (
              <div className="repository-topic-strip">
                <span>Classified topics</span>
                <div>
                  {topicClassifications.map((topic) => (
                    <Link
                      key={topic.slug}
                      href={`/topic/${topic.slug}`}
                      title={topic.evidence ?? "Deterministic topic classification"}
                    >
                      {topic.name}
                      <small>{topic.confidence.toLowerCase()}</small>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {gitAnalysis?.detectedTechnologies && gitAnalysis.detectedTechnologies.length > 0 && (
              <div className="technology-panel">
                <h3>Detected technology</h3>
                <div>
                  {gitAnalysis.detectedTechnologies.map((technology) => (
                    <span key={technology.name}>
                      <strong>{technology.name}</strong>
                      <small>
                        {technology.category} · {technology.confidence.toLowerCase()}
                      </small>
                      <em>{technology.evidence}</em>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {gitAnalysis?.readmeAnalysis && (
              <div className="readme-analysis-panel">
                <div className="readme-analysis-heading">
                  <div>
                    <p className="eyebrow">README / deterministic structure</p>
                    <h3>Documentation signals</h3>
                  </div>
                  <span>{gitAnalysis.readmeAnalysis.version}</span>
                </div>
                <div className="readme-analysis-grid">
                  <Dna label="Observed file" value={gitAnalysis.readmeAnalysis.path} />
                  <Dna
                    label="Blob size"
                    value={formatBytes(gitAnalysis.readmeAnalysis.sizeBytes)}
                  />
                  <Dna
                    label="Lines"
                    value={
                      gitAnalysis.readmeAnalysis.lineCount === null
                        ? "Unavailable"
                        : formatExactNumber(gitAnalysis.readmeAnalysis.lineCount)
                    }
                  />
                  <Dna
                    label="Sections"
                    value={
                      gitAnalysis.readmeAnalysis.sectionCount === null
                        ? "Unavailable"
                        : formatExactNumber(gitAnalysis.readmeAnalysis.sectionCount)
                    }
                  />
                  <Dna
                    label="Badges"
                    value={
                      gitAnalysis.readmeAnalysis.badgeCount === null
                        ? "Unavailable"
                        : formatExactNumber(gitAnalysis.readmeAnalysis.badgeCount)
                    }
                  />
                  <Dna
                    label="Documentation links"
                    value={
                      gitAnalysis.readmeAnalysis.documentationLinkCount === null
                        ? "Unavailable"
                        : formatExactNumber(gitAnalysis.readmeAnalysis.documentationLinkCount)
                    }
                  />
                </div>
                {gitAnalysis.readmeAnalysis.sections.length > 0 && (
                  <div className="readme-section-list" aria-label="Observed README sections">
                    {gitAnalysis.readmeAnalysis.sections.map((section) => (
                      <span key={section}>{section}</span>
                    ))}
                  </div>
                )}
                <p>
                  Installation section:{" "}
                  {gitAnalysis.readmeAnalysis.hasInstallationSection === null
                    ? "not inspected"
                    : gitAnalysis.readmeAnalysis.hasInstallationSection
                      ? "detected"
                      : "not detected"}
                  . These are bounded structural observations, not a documentation-quality score.
                </p>
              </div>
            )}
            {gitAnalysis?.qualitySignals && (
              <div className="quality-panel">
                <h3>Repository signals</h3>
                <div>
                  {Object.entries(gitAnalysis.qualitySignals).map(([signal, detected]) => (
                    <span key={signal} className={detected ? "detected" : "not-detected"}>
                      <i />
                      {signal.replace(/([A-Z])/g, " $1")}
                      {detected ? " detected" : " not detected"}
                    </span>
                  ))}
                </div>
                <p>
                  File presence is evidence, not a claim that the project is secure or high quality.
                </p>
              </div>
            )}
          </section>
          <section id="similar" className="detail-section">
            <div className="detail-section-heading">
              <p className="eyebrow">Similarity / deterministic evidence</p>
              <h2>Related repositories</h2>
              <p>
                Matches use shared language, classified topics, detected technologies, and lifecycle
                only. The score is an evidence overlap—not semantic AI or a quality judgment.
              </p>
            </div>
            {similarRepositories.length > 0 ? (
              <div className="similarity-grid">
                {similarRepositories.map((candidate) => (
                  <div className="similarity-card" key={candidate.id}>
                    <div className="similarity-match">
                      <strong>{candidate.similarity}</strong>
                      <span>/100 evidence match</span>
                    </div>
                    <div>
                      <Link href={`/r/${candidate.owner}/${candidate.name}`}>
                        <span>{candidate.owner}/</span>
                        <strong>{candidate.name}</strong>
                      </Link>
                      <p>{candidate.description ?? "Description unavailable."}</p>
                      <small>{candidate.similarityEvidence.join(" · ")}</small>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <InsufficientData
                action={false}
                detail="No other indexed repository currently shares enough observed language, topic, technology, or lifecycle evidence."
              />
            )}
          </section>
          <section id="rankings" className="detail-section">
            <div className="detail-section-heading">
              <p className="eyebrow">Scope / indexed universe</p>
              <h2>Rankings</h2>
            </div>
            {repository.rank ? (
              <>
                <div className="ranking-callout">
                  <strong>#{repository.rank}</strong>
                  <span>
                    among {model.rankingCohortSize.toLocaleString("en")} repositories currently
                    indexed and scored by ForgeRank
                  </span>
                  <Link href="/repositories">
                    Open leaderboard <ArrowUpRight size={13} />
                  </Link>
                </div>
                <div className="rank-history-panel">
                  <div className="rank-history-heading">
                    <div>
                      <p className="eyebrow">Completed calculations / append only</p>
                      <h3>Global rank history</h3>
                    </div>
                    <span>{rankHistory.length} observations</span>
                  </div>
                  {rankHistory.length >= 2 ? (
                    <RankHistoryChart points={rankHistory} />
                  ) : (
                    <InsufficientData
                      action={false}
                      detail="A rank-history line requires at least two completed global ranking calculations. No intermediate position is reconstructed."
                    />
                  )}
                  <div className="rank-movement-window-grid" aria-label="Ranking movement windows">
                    {rankMovementWindows.map(({ label, movement }) => (
                      <div key={label}>
                        <span>{label}</span>
                        {movement ? (
                          <>
                            <strong className={movement.direction.toLowerCase()}>
                              {movement.direction === "UP"
                                ? "↑"
                                : movement.direction === "DOWN"
                                  ? "↓"
                                  : "—"}{" "}
                              {movement.places}
                            </strong>
                            <small>
                              #{movement.fromRank} → #{movement.toRank} across{" "}
                              {movement.observedSpanDays} observed days
                            </small>
                          </>
                        ) : (
                          <>
                            <strong>Needs baseline</strong>
                            <small>No completed ranking at or before this window.</small>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="rank-history-note">
                    Positions compare only repositories present in each completed ForgeRank ranking
                    run. A lower number is better; missing runs are never interpolated.
                  </p>
                </div>
              </>
            ) : (
              <InsufficientData
                action={false}
                detail="This repository has not yet entered a completed ranking calculation."
              />
            )}
          </section>
          <section id="timeline" className="detail-section">
            <div className="detail-section-heading">
              <p className="eyebrow">Derived history / {REPOSITORY_EVENT_VERSION}</p>
              <h2>Project timeline</h2>
              <p>
                Versioned events derived from retained snapshots, completed ranking runs, and
                bounded Git analyses.
              </p>
            </div>
            {repositoryEvents.length > 0 ? (
              <ol className="repository-timeline" aria-label="Derived repository event timeline">
                {repositoryEvents.map((event) => (
                  <li key={event.id}>
                    <time dateTime={event.occurredAt.toISOString()}>
                      {event.occurredAt.toLocaleDateString("en", { dateStyle: "medium" })}
                    </time>
                    <i aria-hidden="true" />
                    <div>
                      <span>{formatRepositoryEventKind(event.kind)}</span>
                      <strong>{event.title}</strong>
                      <p>{event.detail}</p>
                      <small>
                        {event.source} · {event.confidence.toLowerCase()} confidence ·{" "}
                        {event.version}
                      </small>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <InsufficientData
                action={false}
                detail="No event can be derived yet. ForgeRank requires retained observations that cross a documented threshold."
              />
            )}
            <p className="repository-timeline-note">
              Events use ForgeRank observation timestamps. Exact external milestone times are not
              interpolated or reconstructed between observations.
            </p>
          </section>
          <section id="history" className="detail-section">
            <div className="detail-section-heading">
              <p className="eyebrow">Audit trail / sources</p>
              <h2>Observation history</h2>
            </div>
            {snapshots.length > 0 ? (
              <div
                className="history-table"
                role="table"
                aria-label="Repository observation history"
              >
                <div role="row">
                  <strong role="columnheader">Observed</strong>
                  <strong role="columnheader">Stars</strong>
                  <strong role="columnheader">Forks</strong>
                  <strong role="columnheader">Confidence</strong>
                </div>
                {[...snapshots].reverse().map((snapshot) => (
                  <div role="row" key={snapshot.id}>
                    <span role="cell">{snapshot.observedAt.toLocaleString("en")}</span>
                    <span role="cell">{formatExactNumber(snapshot.stars)}</span>
                    <span role="cell">{formatExactNumber(snapshot.forks)}</span>
                    <span
                      role="cell"
                      className={`confidence confidence-${snapshot.confidence.toLowerCase()}`}
                    >
                      {snapshot.confidence}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <InsufficientData
                action={false}
                detail="No source observation has been persisted for this repository."
              />
            )}
          </section>
        </main>
        <aside className="detail-aside">
          <div className="aside-card">
            <p className="eyebrow">Data context</p>
            <dl>
              <div>
                <dt>Source</dt>
                <dd>Public repository HTML</dd>
              </div>
              <div>
                <dt>Parser</dt>
                <dd>{latest?.parserVersion ?? "Pending"}</dd>
              </div>
              <div>
                <dt>Score version</dt>
                <dd>{latest?.scoreVersion ?? "Pending"}</dd>
              </div>
              <div>
                <dt>Snapshots</dt>
                <dd>{snapshots.length}</dd>
              </div>
              <div>
                <dt>Confidence</dt>
                <dd>{repository.scoreConfidence}</dd>
              </div>
            </dl>
          </div>
          <div className="aside-card">
            <Scale size={18} />
            <strong>Scope matters.</strong>
            <p>
              Ranks compare this project only with repositories currently indexed and scored by
              ForgeRank.
            </p>
            <Link href="/coverage">View index coverage</Link>
          </div>
          <div className="aside-card">
            <CalendarDays size={18} />
            <strong>Stars are attention.</strong>
            <p>
              ForgeRank does not treat stars as code quality. They are one reach and momentum signal
              among several.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

function ScoreBar({
  label,
  value,
  maximum,
}: {
  label: string;
  value: string | null;
  maximum: number;
}) {
  const numeric = value === null ? 0 : Number(value);
  return (
    <div>
      <span>{label}</span>
      <i>
        <b style={{ width: `${(numeric / maximum) * 100}%` }} />
      </i>
      <strong>
        {value === null ? "—" : numeric.toFixed(1)}
        <small>/{maximum}</small>
      </strong>
    </div>
  );
}
function formatReasonTone(tone: RepositoryScoreReasonTone): string {
  if (tone === "POSITIVE") return "Positive";
  if (tone === "CAUTION") return "Caution";
  if (tone === "MISSING") return "Missing evidence";
  return "Observed";
}
function formatRepositoryEventKind(kind: RepositoryEventKind): string {
  if (kind === "TRACKING_STARTED") return "Tracking";
  if (kind === "STAR_MILESTONE") return "Observed reach";
  if (kind === "RANK_MILESTONE") return "Indexed rank";
  if (kind === "MOMENTUM_INCREASED") return "Score movement";
  if (kind === "ACTIVITY_RESUMED") return "Activity";
  if (kind === "NEW_TAGS_OBSERVED") return "Git tags";
  return "Lifecycle";
}
function Dna({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function UnknownRepository({ owner, repo }: { owner: string; repo: string }) {
  return (
    <section className="shell unknown-repository">
      <p className="eyebrow">Index / no record</p>
      <h1>
        {owner}/{repo}
      </h1>
      <p>
        ForgeRank has no indexed record for this public identifier. No metadata has been guessed.
      </p>
      <Link
        className="button button-primary"
        href={`/index?repository=${encodeURIComponent(`${owner}/${repo}`)}`}
      >
        Request indexing
      </Link>
    </section>
  );
}
