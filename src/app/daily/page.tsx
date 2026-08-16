import {
  ArrowUpDown,
  CalendarDays,
  Flame,
  Languages,
  RotateCcw,
  Sparkles,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";

import { getDailyReportReadModel } from "@/application/report-read-model";
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
  title: "Open Source Daily — observed repository and ecosystem intelligence",
  description:
    "A deterministic daily digest of repository momentum, rank movement, breakouts, new observations, ecosystems, and revivals in ForgeRank's indexed universe.",
};

export default async function DailyPage() {
  const report = await getDailyReportReadModel();
  const date = new Intl.DateTimeFormat("en", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(report.asOf);
  return (
    <>
      <PageHeader
        eyebrow="Open Source Daily / deterministic UTC edition"
        title={date}
        description="Observed momentum, rank movement, ecosystem change, and new projects across ForgeRank's indexed universe. Empty sections mean the evidence window is not yet defensible."
      />
      <section className="shell content-section report-layout">
        <ReportCoveragePanel coverage={report.coverage} windowLabel="Daily" />
        <DiscoveryReportSection
          icon={Flame}
          title="Fastest rising"
          signalLabel="Observed 24-hour window"
          rankings={report.fastestRising}
          empty="No repository has at least two valid observations and positive growth across the daily window."
        />
        <RankMoversReportSection
          icon={ArrowUpDown}
          movements={report.rankMovers}
          empty="Two completed ranking runs with a changed position are required before daily movement can be reported."
        />
        <DiscoveryReportSection
          icon={Zap}
          title="New breakout projects"
          signalLabel="Seven-day breakout evidence"
          rankings={report.breakouts}
          empty="No project currently meets the four-observation, six-day, accelerating-growth, and engineering-activity breakout gate."
        />
        <NewRepositoriesReportSection
          icon={Sparkles}
          title="Interesting new repositories"
          windowLabel="Observed after discovery / 24h"
          repositories={report.newRepositories}
          empty="No active, non-fork repository discovered in the last 24 hours has a validated public observation yet."
        />
        <EcosystemReportSection
          icon={Languages}
          movements={report.ecosystemGainers}
          windowLabel="Persisted language history / 24h"
          empty="Language momentum requires a persisted baseline at least one day old. No ecosystem values are reconstructed."
        />
        <DiscoveryReportSection
          icon={RotateCcw}
          title="Projects revived"
          signalLabel="Lifecycle and bounded Git activity"
          rankings={report.revived}
          empty="No indexed project currently has both a revived lifecycle classification and sufficient bounded Git activity."
        />
        <div className="report-method">
          <CalendarDays size={18} aria-hidden="true" />
          <p>
            Generated at {report.coverage.generatedAt.toLocaleString("en-GB", { timeZone: "UTC" })}{" "}
            UTC. A calendar date does not imply every repository was fetched that day. Each section
            publishes only the observations and completed calculations that satisfy its own window.
          </p>
        </div>
      </section>
    </>
  );
}
