import {
  Activity,
  CalendarClock,
  Database,
  ExternalLink,
  GitCommitHorizontal,
  Languages,
  MapPin,
  Network,
  ShieldCheck,
  Users,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { getDeveloperReadModel } from "@/application/read-model";
import { RepositoryCard } from "@/components/data/repository-card";
import { InsufficientData } from "@/components/data/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { formatCompactNumber } from "@/domain/format";

export const dynamic = "force-dynamic";

export default async function DeveloperPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const model = await getDeveloperReadModel(username);
  if (!model)
    return (
      <>
        <PageHeader
          eyebrow="Developer / no confirmed profile"
          title={`@${username}`}
          description="ForgeRank has no public confirmed developer record for this username and will not assemble one from unlinked Git-author data."
        />
        <section className="shell content-section">
          <InsufficientData
            action={false}
            detail="A missing or removed profile and a Git commit author name are not sufficient evidence of a corresponding public account."
          />
        </section>
      </>
    );

  const {
    developer,
    repositories,
    snapshots,
    repositoriesWithActivity,
    intelligence,
    timeline,
    confirmedContributions,
  } = model;
  const latest = snapshots.at(-1) ?? null;
  const dimensions = latest
    ? ([
        ["Impact", latest.impactScore, 25],
        ["Consistency", latest.consistencyScore, 20],
        ["Collaboration", latest.collaborationScore, 20],
        ["Project quality", latest.projectQualityScore, 15],
        ["Breadth", latest.breadthScore, 10],
        ["Trust", latest.trustScore, 10],
      ] as const)
    : [];
  const contactUrl = correctionContactUrl();

  return (
    <>
      <PageHeader
        eyebrow="Developer / indexed public profile"
        title={developer.displayName ?? developer.username}
        description={developer.bio ?? "Public biography unavailable."}
      />
      <section className="shell content-section developer-report">
        <div className="developer-profile-strip">
          {developer.avatarUrl ? (
            <Image
              className="developer-profile-avatar"
              src={developer.avatarUrl}
              alt=""
              width={82}
              height={82}
              priority
            />
          ) : (
            <span className="developer-profile-avatar developer-avatar-fallback" aria-hidden="true">
              {developer.username.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div>
            <strong>@{developer.username}</strong>
            {developer.location && (
              <span>
                <MapPin size={13} />
                {developer.location}
              </span>
            )}
            <small>
              Profile observed{" "}
              {developer.lastIndexedAt?.toLocaleDateString("en-GB", { dateStyle: "medium" })}
            </small>
          </div>
          <a href={developer.sourceUrl} rel="noreferrer" target="_blank">
            Public source <ExternalLink size={13} />
          </a>
        </div>

        <div className="developer-score-head">
          <div>
            <span>ForgeRank Developer Score</span>
            <strong>{developer.currentScore ?? "—"}</strong>
            <small>
              {developer.scoreConfidence.toLowerCase()} confidence ·{" "}
              {developer.scoreVersion ?? "score pending"}
            </small>
          </div>
          <p>
            This score describes public evidence across explicitly owned original repositories.
            Project activity and collaboration do not claim that every repository commit belongs to
            this account.
          </p>
        </div>
        {latest && developer.currentScore !== null ? (
          <>
            <div className="developer-dimensions">
              {dimensions.map(([label, value, maximum]) => {
                const dimensionScore = value === null ? null : Number(value);
                return (
                  <div key={label}>
                    <span>{label}</span>
                    <strong>{dimensionScore === null ? "—" : dimensionScore}</strong>
                    <small>/ {maximum}</small>
                    <i>
                      <b
                        style={{
                          width: `${dimensionScore === null ? 0 : Math.min(100, (dimensionScore / maximum) * 100)}%`,
                        }}
                      />
                    </i>
                  </div>
                );
              })}
            </div>
            <div className="developer-evidence">
              <div>
                <Database size={17} />
                <span>Indexed original repositories</span>
                <strong>{latest.repositoriesIndexed}</strong>
              </div>
              <div>
                <ShieldCheck size={17} />
                <span>Observed stars across portfolio</span>
                <strong>{formatCompactNumber(latest.ownedOriginalStars)}</strong>
              </div>
              <div>
                <span>Profile evidence</span>
                <strong>{latest.confidence.toLowerCase()}</strong>
                <small>{latest.parserVersion}</small>
              </div>
            </div>
          </>
        ) : (
          <InsufficientData
            action={false}
            title="Profile confirmed; score pending."
            detail="ForgeRank needs at least one confirmed original repository with an observed public snapshot before publishing a score."
          />
        )}

        <section className="developer-intelligence-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Activity / owned project evidence</span>
              <h2>Repository activity</h2>
            </div>
            <p>These are project-level Git signals, not personal contribution totals.</p>
          </div>
          {intelligence.analyzedRepositoryCount > 0 ? (
            <div className="developer-activity-grid">
              <DeveloperMetric
                icon={GitCommitHorizontal}
                label="Repository commits / 30d"
                value={formatNullable(intelligence.totalCommits30d)}
              />
              <DeveloperMetric
                icon={Activity}
                label="Repository commits / 90d"
                value={formatNullable(intelligence.totalCommits90d)}
              />
              <DeveloperMetric
                icon={CalendarClock}
                label="Average active weeks / 12"
                value={
                  intelligence.averageActiveWeeks12 === null
                    ? "Unavailable"
                    : `${intelligence.averageActiveWeeks12.toFixed(1)}/12`
                }
              />
              <DeveloperMetric
                icon={Database}
                label="Git-analyzed projects"
                value={`${intelligence.analyzedRepositoryCount} of ${intelligence.repositoryCount}`}
              />
              <DeveloperMetric
                icon={Languages}
                label="Strongest owned-project language"
                value={intelligence.strongestLanguage ?? "Unavailable"}
              />
              <DeveloperMetric
                icon={CalendarClock}
                label="Latest project commit"
                value={
                  intelligence.latestCommitAt?.toLocaleDateString("en-GB", {
                    dateStyle: "medium",
                  }) ?? "Unavailable"
                }
              />
            </div>
          ) : (
            <InsufficientData
              action={false}
              detail="Activity totals, consistency, weekday patterns, and heatmaps remain unavailable until bounded Git inspection covers owned repositories with sufficient history."
            />
          )}
        </section>

        <section className="developer-intelligence-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Collaboration / project context</span>
              <h2>Multi-author work</h2>
            </div>
            <p>
              Git authors remain privacy-safe repository identities unless an independent account
              link is confirmed.
            </p>
          </div>
          {intelligence.collaborationCoverage > 0 ? (
            <>
              <div className="developer-activity-grid">
                <DeveloperMetric
                  icon={Network}
                  label="Collaborative owned projects"
                  value={`${intelligence.collaborativeRepositoryCount ?? 0} of ${intelligence.collaborationCoverage} analyzed`}
                />
                <DeveloperMetric
                  icon={Users}
                  label="Git author-project presences / 90d"
                  value={formatNullable(intelligence.authorRepositoryPresences90d)}
                />
                <DeveloperMetric
                  icon={ShieldCheck}
                  label="Average top-author concentration"
                  value={
                    intelligence.averageTopContributorShare === null
                      ? "Unavailable"
                      : `${Math.round(intelligence.averageTopContributorShare * 100)}%`
                  }
                />
              </div>
              <div className="developer-project-activity">
                {repositoriesWithActivity
                  .filter((entry) => entry.analysis)
                  .map(({ repository, analysis }) => (
                    <Link
                      key={repository.id}
                      href={`/r/${repository.owner}/${repository.name}#contributors`}
                    >
                      <span>{repository.fullName}</span>
                      <strong>{analysis?.uniqueAuthors90d ?? "—"} Git authors / 90d</strong>
                      <small>
                        {analysis?.commits90d ?? "—"} commits · top-author share{" "}
                        {analysis?.topContributorShare === null ||
                        analysis?.topContributorShare === undefined
                          ? "unavailable"
                          : `${Math.round(Number(analysis.topContributorShare) * 100)}%`}
                      </small>
                    </Link>
                  ))}
              </div>
            </>
          ) : (
            <InsufficientData
              action={false}
              detail="No owned repository has enough Git-author evidence to publish collaboration breadth yet."
            />
          )}
        </section>

        <section className="developer-intelligence-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Languages / observed portfolio</span>
              <h2>Ecosystem breadth</h2>
            </div>
            <p>
              {intelligence.languages.length} primary{" "}
              {intelligence.languages.length === 1 ? "language" : "languages"} across indexed
              original projects.
            </p>
          </div>
          {intelligence.languages.length > 0 ? (
            <div className="developer-language-list">
              {intelligence.languages.map((language) => (
                <div key={language.name}>
                  <span>{language.name}</span>
                  <strong>
                    {language.repositories} repositor{language.repositories === 1 ? "y" : "ies"}
                  </strong>
                  <small>{formatCompactNumber(language.stars)} observed stars</small>
                  <i>
                    <b
                      style={{
                        width: `${(language.repositories / Math.max(...intelligence.languages.map((item) => item.repositories))) * 100}%`,
                      }}
                    />
                  </i>
                </div>
              ))}
            </div>
          ) : (
            <InsufficientData
              action={false}
              detail="Primary-language evidence is unavailable across this observed portfolio."
            />
          )}
        </section>

        <section className="developer-intelligence-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Contributions / confirmed identity only</span>
              <h2>Account-linked contributions</h2>
            </div>
            <p>
              ForgeRank publishes this section only when a privacy-safe Git author has independent
              evidence linking it to the confirmed public account.
            </p>
          </div>
          {confirmedContributions.length > 0 ? (
            <div className="developer-project-activity">
              {confirmedContributions.map(({ contributor, repository }) => (
                <Link
                  key={`${repository.id}:${contributor.contributorKey}`}
                  href={`/r/${repository.owner}/${repository.name}#contributors`}
                >
                  <span>{repository.fullName}</span>
                  <strong>{contributor.commits} linked commits</strong>
                  <small>Confirmed account link · source Git identity retained separately</small>
                </Link>
              ))}
            </div>
          ) : (
            <InsufficientData
              action={false}
              detail="No Git-author identity has a confirmed public-account link. ForgeRank will not infer one from a name or commit email."
            />
          )}
        </section>

        <section className="developer-intelligence-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Timeline / provenance</span>
              <h2>Evidence events</h2>
            </div>
            <p>
              Only ForgeRank observations, score calculations, and owned-project inspections appear
              here.
            </p>
          </div>
          {timeline.length > 0 ? (
            <div className="developer-timeline">
              {timeline.map((event, index) => (
                <div key={`${event.kind}:${event.occurredAt.toISOString()}:${index}`}>
                  <time dateTime={event.occurredAt.toISOString()}>
                    {event.occurredAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}
                  </time>
                  <i />
                  <span>
                    <strong>{event.title}</strong>
                    <small>{event.detail}</small>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <InsufficientData
              action={false}
              detail="No evidence events have been retained for this confirmed profile yet."
            />
          )}
        </section>

        <div className="section-heading developer-portfolio-heading">
          <div>
            <span className="eyebrow">Observed portfolio</span>
            <h2>Owned original repositories</h2>
          </div>
          <p>
            {repositories.length} public {repositories.length === 1 ? "repository" : "repositories"}{" "}
            currently meet the evidence boundary.
          </p>
        </div>
        {repositories.length > 0 ? (
          <div className="repository-grid">
            {repositories.map((repository) => (
              <RepositoryCard key={repository.id} repository={repository} />
            ))}
          </div>
        ) : (
          <InsufficientData
            action={false}
            detail="Seed identifiers and Git authors are not portfolio evidence. Only indexed repositories with an explicit non-fork signal appear here."
          />
        )}

        <div className="developer-boundary">
          <strong>Identity and correction boundary</strong>
          <p>
            Repository ownership follows the observed public owner field. Contribution authors
            remain pseudonymous Git identities until independently supported. Profile removal and
            field corrections create local audit events; they do not silently erase aggregate
            repository history.
          </p>
          <span>
            <Link href="/methodology">Scoring methodology</Link>
            <a
              href={contactUrl}
              target={contactUrl.startsWith("http") ? "_blank" : undefined}
              rel={contactUrl.startsWith("http") ? "noreferrer" : undefined}
            >
              Request correction or removal
            </a>
          </span>
        </div>
      </section>
    </>
  );
}

function DeveloperMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div>
      <Icon size={15} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatNullable(value: number | null): string {
  return value === null ? "Unavailable" : formatCompactNumber(value);
}

function correctionContactUrl(): string {
  const configured = process.env.FORGERANK_CONTACT_URL;
  if (!configured) return "/data-policy#corrections";
  try {
    const url = new URL(configured);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : "/data-policy#corrections";
  } catch {
    return "/data-policy#corrections";
  }
}
