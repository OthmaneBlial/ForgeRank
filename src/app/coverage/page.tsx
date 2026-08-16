import {
  BookOpen,
  Box,
  Braces,
  ChartNoAxesCombined,
  Clock3,
  Database,
  GitBranch,
  History,
  RefreshCw,
  Users,
} from "lucide-react";
import Link from "next/link";

import { getCoverageReadModel } from "@/application/read-model";
import { Metric } from "@/components/data/metric";
import { PageHeader } from "@/components/shell/page-header";
import { formatCompactNumber, formatObservationAge } from "@/domain/format";

export const dynamic = "force-dynamic";

export default async function CoveragePage() {
  const coverage = await getCoverageReadModel();
  return (
    <>
      <PageHeader
        eyebrow="Coverage / public index health"
        title="Know the denominator"
        description="Public, lightweight coverage and freshness context for every ForgeRank ranking and trend. Internal queue and source details stay on the protected operator page."
      />
      <section className="shell content-section">
        <div className="coverage-grid">
          <Metric
            label="Discovered repositories"
            value={formatCompactNumber(coverage.total)}
            icon={Database}
          />
          <Metric
            label="Observed repositories"
            value={formatCompactNumber(coverage.indexed)}
            detail={
              coverage.total > 0
                ? `${Math.round((coverage.indexed / coverage.total) * 100)}% of discovered`
                : "No seeds loaded"
            }
            icon={Box}
          />
          <Metric
            label="Scored repositories"
            value={formatCompactNumber(coverage.scored)}
            detail={`${coverage.scored}/${coverage.indexed} observed`}
            icon={ChartNoAxesCombined}
          />
          <Metric
            label="Confirmed developers"
            value={formatCompactNumber(coverage.developers)}
            detail="Public profiles only"
            icon={Users}
          />
          <Metric
            label="Languages"
            value={formatCompactNumber(coverage.languages)}
            detail="From observed repositories"
            icon={Braces}
          />
          <Metric
            label="Collections"
            value={formatCompactNumber(coverage.collections)}
            detail="Version-controlled curation"
            icon={BookOpen}
          />
        </div>

        <div className="section-heading coverage-health-heading">
          <div>
            <p className="eyebrow">Public data health</p>
            <h2>Freshness without internal exposure</h2>
          </div>
          <p>These values describe ForgeRank&apos;s own retained observations and policy cadence.</p>
        </div>
        <div className="coverage-grid">
          <Metric
            label="Repository snapshots"
            value={formatCompactNumber(coverage.snapshots)}
            detail={
              coverage.historyStartedAt
                ? `History since ${coverage.historyStartedAt.toLocaleDateString("en", { timeZone: "UTC" })} UTC`
                : "No observation history"
            }
            icon={History}
          />
          <Metric
            label="Latest snapshot"
            value={formatObservationAge(coverage.latestSnapshotAt).replace("Updated ", "")}
            detail="Newest retained repository observation"
            icon={Clock3}
          />
          <Metric
            label="Refreshed / 24h"
            value={formatCompactNumber(coverage.refreshed24h)}
            detail="Successful repository observations"
            icon={RefreshCw}
          />
          <Metric
            label="Refresh due"
            value={formatCompactNumber(coverage.refreshDue)}
            detail="Past the policy-derived next refresh time"
            icon={Clock3}
          />
          <Metric
            label="Git-analyzed repositories"
            value={formatCompactNumber(coverage.gitAnalyzed)}
            detail={`${coverage.gitAnalyzed}/${coverage.indexed} observed`}
            icon={GitBranch}
          />
          <Metric
            label="Last ranking"
            value={formatObservationAge(coverage.lastRanking).replace("Updated ", "")}
            detail="Most recent completed repository ranking"
            icon={ChartNoAxesCombined}
          />
        </div>

        <div className="coverage-note">
          <div>
            <span>Index model</span>
            <strong>Relevance-driven</strong>
            <p>
              Curated seeds, public discovery where permitted, user submissions, and collection expansion.
              ForgeRank does not attempt to crawl all of GitHub.
            </p>
          </div>
          <div>
            <span>Historical horizon</span>
            <strong>{coverage.snapshots > 0 ? "Snapshots accumulating" : "Not started"}</strong>
            <p>
              Weekly velocity needs 7+ days, monthly momentum 30+ days, and sustained acceleration 90+ days.
              Missing windows stay unavailable.
            </p>
          </div>
          <div>
            <span>Transparency</span>
            <strong>Indexed universe only</strong>
            <p>Every rank is scoped to the entities actually observed, scored, and eligible for that view.</p>
          </div>
        </div>
        <Link className="button button-secondary" href="/methodology">
          Read scoring methodology
        </Link>
      </section>
    </>
  );
}
