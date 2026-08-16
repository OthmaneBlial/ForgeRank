import { RepositoryCard } from "@/components/data/repository-card";
import { InsufficientData } from "@/components/data/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { getCollectionReadModel } from "@/application/read-model";

export const dynamic = "force-dynamic";

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const model = await getCollectionReadModel(slug);
  if (!model)
    return (
      <>
        <PageHeader
          eyebrow="Collection / unavailable"
          title="Collection not found"
          description="This collection is not present in the current ForgeRank index."
        />
      </>
    );
  return (
    <>
      <PageHeader
        eyebrow="Curated collection / ForgeRank"
        title={model.collection.name}
        description={model.collection.description}
      />
      <section className="shell content-section">
        {model.repositories.length > 0 ? (
          <div className="repository-grid">
            {model.repositories.map((repository, index) => (
              <RepositoryCard key={repository.id} repository={repository} index={index} />
            ))}
          </div>
        ) : (
          <InsufficientData detail="This collection's repository identifiers have not been linked to the index yet." />
        )}
      </section>
    </>
  );
}
