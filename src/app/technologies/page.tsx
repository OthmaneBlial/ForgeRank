import { Boxes, Cpu, Database, GitBranch, TestTube2 } from "lucide-react";
import Link from "next/link";

import { getTechnologiesReadModel } from "@/application/read-model";
import { InsufficientData } from "@/components/data/empty-state";
import { PageHeader } from "@/components/shell/page-header";

export const dynamic = "force-dynamic";

const icons = {
  runtime: Cpu,
  framework: Boxes,
  database: Database,
  infrastructure: GitBranch,
  testing: TestTube2,
} as const;

export default async function TechnologiesPage() {
  const technologies = await getTechnologiesReadModel();
  return (
    <>
      <PageHeader
        eyebrow="Ecosystems / deterministic technology"
        title="Stacks visible in the tree"
        description="Technologies are detected from bounded repository trees and allowlisted manifests. Presence is evidence of use, not a quality or security endorsement."
      />
      <section className="shell content-section">
        {technologies.length > 0 ? (
          <div className="technology-index-grid">
            {technologies.map((technology, index) => {
              const Icon = icons[technology.category as keyof typeof icons] ?? Cpu;
              return (
                <Link key={technology.slug} href={`/technology/${technology.slug}`}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <Icon size={18} />
                  <div>
                    <strong>{technology.name}</strong>
                    <small>{technology.category}</small>
                  </div>
                  <b>
                    {technology.repositoryCount}
                    <small> indexed</small>
                  </b>
                </Link>
              );
            })}
          </div>
        ) : (
          <InsufficientData
            title="No technology evidence is indexed."
            detail="Technology ecosystems appear after bounded Git inspection detects supported manifests and repository-tree signals."
          />
        )}
      </section>
    </>
  );
}
