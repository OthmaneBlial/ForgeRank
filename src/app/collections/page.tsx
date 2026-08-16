import { ArrowUpRight, Layers3 } from "lucide-react";
import Link from "next/link";

import { getCollectionsReadModel } from "@/application/read-model";
import { InsufficientData } from "@/components/data/empty-state";
import { PageHeader } from "@/components/shell/page-header";

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const collections = await getCollectionsReadModel();
  return (
    <>
      <PageHeader
        eyebrow="Curated pathways / collections"
        title="Read the ecosystem in chapters"
        description="Version-controlled editorial collections whose repositories are enriched by the same real ingestion and scoring pipeline."
      />
      <section className="shell content-section">
        {collections.length > 0 ? (
          <div className="collection-grid">
            {collections.map((collection, index) => (
              <Link
                key={collection.slug}
                className="collection-card"
                href={`/collection/${collection.slug}`}
              >
                <div className="collection-index">COL / {String(index + 1).padStart(2, "0")}</div>
                <Layers3 size={27} />
                <h2>{collection.name}</h2>
                <p>{collection.description}</p>
                <div>
                  <span>{collection.repositoryCount} repositories</span>
                  <ArrowUpRight size={15} />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <InsufficientData
            title="No collections are loaded."
            detail="Run the seed command to load the version-controlled collection definitions."
          />
        )}
      </section>
    </>
  );
}
