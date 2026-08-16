import { ArrowRight, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { getTechnologyReadModel } from "@/application/read-model";
import { InsufficientData } from "@/components/data/empty-state";
import { RepositoryTable } from "@/components/data/repository-table";
import { PageHeader } from "@/components/shell/page-header";

export const dynamic = "force-dynamic";

export default async function TechnologyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const technology = await getTechnologyReadModel(slug);
  if (!technology)
    return (
      <>
        <PageHeader
          eyebrow="Technology / no observed evidence"
          title={slug.replace(/-/g, " ")}
          description="No current Git analysis contains this deterministic technology signal."
        />
        <section className="shell content-section">
          <InsufficientData
            action={false}
            detail="ForgeRank does not create ecosystem entries from a name alone."
          />
        </section>
      </>
    );
  const repositories = [...technology.repositories].sort(
    (left, right) =>
      (right.score ?? -1) - (left.score ?? -1) || left.fullName.localeCompare(right.fullName),
  );
  return (
    <>
      <PageHeader
        eyebrow={`Technology / ${technology.category}`}
        title={technology.name}
        description={`${technology.repositoryCount} currently indexed ${technology.repositoryCount === 1 ? "repository exposes" : "repositories expose"} deterministic evidence for this technology.`}
      />
      <section className="shell content-section">
        <div className="technology-context">
          <ShieldCheck size={18} />
          <p>
            Detection uses public repository trees and bounded manifest contents. It does not claim
            dependency reachability, secure configuration, or runtime deployment.
          </p>
          <Link href="/methodology">
            Methodology <ArrowRight size={13} />
          </Link>
        </div>
        {repositories.length > 0 ? (
          <RepositoryTable repositories={repositories} />
        ) : (
          <InsufficientData />
        )}
      </section>
    </>
  );
}
