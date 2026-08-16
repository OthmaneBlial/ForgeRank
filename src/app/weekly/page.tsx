import {
  ArrowUpDown,
  CalendarRange,
  Flame,
  Languages,
  Sparkles,
  Trophy,
  UserRound,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { getWeeklyReportReadModel } from "@/application/report-read-model";
import { InsufficientData } from "@/components/data/empty-state";
import { RepositoryTable } from "@/components/data/repository-table";
import {
  DiscoveryReportSection,
  EcosystemReportSection,
  NewRepositoriesReportSection,
  RankMoversReportSection,
  ReportCoveragePanel,
} from "@/components/reports/report-sections";
import { PageHeader } from "@/components/shell/page-header";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Open Source Weekly — rankings, ecosystems, and projects to watch",
  description:
    "A deterministic weekly report built from ForgeRank's persisted repository, ranking, ecosystem, and confirmed developer evidence.",
};

export default async function WeeklyPage() {
  const report = await getWeeklyReportReadModel();
  const { week, year } = isoWeek(report.asOf);
  return (
    <>
      <PageHeader
        eyebrow={`Open Source Week ${week} / ${year}`}
        title="The week in open source"
        description="Sustained movement, ecosystem changes, new projects, rank shifts, and a confirmed developer profile across ForgeRank's observed dataset."
      />
      <section className="shell content-section report-layout">
        <ReportCoveragePanel coverage={report.coverage} windowLabel="Weekly" />
        <section className="report-section">
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">
                <Trophy size={11} aria-hidden="true" /> Latest completed ranking
              </p>
              <h2>Top 20 repositories</h2>
            </div>
          </div>
          {report.topRepositories.length > 0 ? (
            <RepositoryTable
              repositories={report.topRepositories}
              signalLabel="7D observed change"
            />
          ) : (
            <InsufficientData
              title="No completed ranking is available."
              detail="The weekly table appears only after versioned repository scores have entered a completed global ranking run."
            />
          )}
        </section>
        <DiscoveryReportSection
          icon={Flame}
          title="Fastest rising projects"
          signalLabel="Observed seven-day window"
          rankings={report.fastestRising}
          empty="No repository has a defensible positive seven-day growth window. Missing days are not interpolated."
        />
        <EcosystemReportSection
          icon={Languages}
          movements={report.ecosystemGainers}
          windowLabel="Persisted language history / 7d"
          empty="Fastest-growing ecosystems require a persisted language baseline at least seven days old."
        />
        <NewRepositoriesReportSection
          icon={Sparkles}
          title="New projects to watch"
          windowLabel="Observed after discovery / 7d"
          repositories={report.newRepositories}
          empty="No active, non-fork repository discovered this week has a validated public observation yet."
        />
        <RankMoversReportSection
          icon={ArrowUpDown}
          movements={report.rankMovers}
          empty="No rank changed across the two most recent completed ranking runs."
        />
        <section className="report-section">
          <div className="section-heading compact-heading">
            <div>
              <p className="eyebrow">
                <UserRound size={11} aria-hidden="true" /> Confirmed public profile
              </p>
              <h2>Developer spotlight</h2>
            </div>
          </div>
          {report.developerSpotlight ? (
            <Link
              className="report-developer-spotlight"
              href={`/d/${report.developerSpotlight.username}`}
            >
              <div>
                <span>Observed open-source portfolio</span>
                <strong>
                  {report.developerSpotlight.displayName ?? report.developerSpotlight.username}
                </strong>
                <small>@{report.developerSpotlight.username}</small>
              </div>
              <div>
                <span>Developer ForgeRank</span>
                <strong>{report.developerSpotlight.currentScore ?? "—"}</strong>
                <small>{report.developerSpotlight.scoreConfidence.toLowerCase()} confidence</small>
              </div>
              <p>
                This spotlight uses a confirmed public profile and explicitly owned original
                projects. It does not infer account identity from Git author names or email
                addresses.
              </p>
            </Link>
          ) : (
            <InsufficientData
              action={false}
              detail="No public developer profile currently has enough confirmed portfolio evidence for a weekly spotlight."
            />
          )}
        </section>
        <div className="report-method">
          <CalendarRange size={18} aria-hidden="true" />
          <p>
            Generated at {report.coverage.generatedAt.toLocaleString("en-GB", { timeZone: "UTC" })}{" "}
            UTC. Weekly summaries use persisted observations and completed calculations. Missing
            daily observations reduce coverage; they are not interpolated into facts.
          </p>
        </div>
      </section>
    </>
  );
}

function isoWeek(value: Date): { week: number; year: number } {
  const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const year = date.getUTCFullYear();
  const yearStart = new Date(Date.UTC(year, 0, 1));
  return { week: Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7), year };
}
