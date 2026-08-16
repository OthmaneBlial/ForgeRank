import { ArrowLeft, Database, Scale, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { getEcosystemComparisonReadModel } from "@/application/comparison-read-model";
import { EcosystemCompareBuilder } from "@/components/compare/ecosystem-compare-builder";
import { InsufficientData } from "@/components/data/empty-state";
import { PageHeader } from "@/components/shell/page-header";

export const dynamic = "force-dynamic";

export default async function EcosystemComparePage() {
  const model = await getEcosystemComparisonReadModel([]);
  const initial = model.candidateEcosystems.slice(0, 2).map((ecosystem) => ecosystem.slug);
  return (
    <>
      <PageHeader
        eyebrow="Comparison / indexed ecosystems"
        title="Compare language ecosystems"
        description="Contrast two to five language cohorts using only repositories observed by ForgeRank. This is dataset analysis, not global market share."
      />
      <section className="shell content-section">
        <Link className="back-link" href="/compare">
          <ArrowLeft size={14} /> Compare repositories instead
        </Link>
        {model.candidateEcosystems.length >= 2 ? (
          <EcosystemCompareBuilder candidates={model.candidateEcosystems} initial={initial} />
        ) : (
          <InsufficientData
            title="Two ecosystems are required."
            detail="ForgeRank needs observed repositories in at least two primary languages before an ecosystem comparison is defensible."
          />
        )}
        <div className="comparison-principles">
          <div>
            <span>
              <Database size={14} />
            </span>
            <strong>Indexed cohort</strong>
            <p>Every total reports its repository denominator and current ForgeRank universe.</p>
          </div>
          <div>
            <span>
              <Scale size={14} />
            </span>
            <strong>Like-for-like metrics</strong>
            <p>
              Published score scales stay fixed; raw count bars are relative only inside this
              comparison.
            </p>
          </div>
          <div>
            <span>
              <ShieldCheck size={14} />
            </span>
            <strong>Evidence coverage</strong>
            <p>Scored and Git-analyzed coverage remain visible beside each aggregate.</p>
          </div>
        </div>
      </section>
    </>
  );
}
