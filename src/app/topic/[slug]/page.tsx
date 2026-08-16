import { InsufficientData } from "@/components/data/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { RepositoryCard } from "@/components/data/repository-card";
import { getTopicReadModel } from "@/application/read-model";

export const dynamic = "force-dynamic";

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const model = await getTopicReadModel(slug);
  const name =
    model?.topic.name ??
    slug
      .split("-")
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(" ");
  return (
    <>
      <PageHeader
        eyebrow="Indexed ecosystem / topic"
        title={name}
        description={
          model?.topic.description ??
          `Repositories classified into ${name} through public metadata and deterministic repository-content evidence.`
        }
      />
      <section className="shell content-section">
        {model && model.repositories.length > 0 ? (
          <>
            <div className="classification-note">
              Every inclusion below carries deterministic description or technology evidence.
              Repositories may belong to multiple topics.
            </div>
            <div className="repository-grid">
              {model.repositories.map((repository, index) => (
                <div key={repository.id} className="classified-repository">
                  <RepositoryCard repository={repository} index={index} />
                  <span>
                    {repository.topicConfidence.toLowerCase()} confidence ·{" "}
                    {repository.topicEvidence}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <InsufficientData
            action={false}
            detail="No repositories have completed topic classification for this ecosystem. ForgeRank does not populate it from a hard-coded analytics list."
          />
        )}
      </section>
    </>
  );
}
