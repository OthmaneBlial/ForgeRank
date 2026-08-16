import { ArrowRight, Compass, Gem, History, Sprout } from "lucide-react";
import Link from "next/link";

import { getDiscoveryPageReadModel } from "@/application/discovery-read-model";
import { RepositoryCard } from "@/components/data/repository-card";
import { InsufficientData } from "@/components/data/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { SurpriseButton } from "@/components/discover/surprise-button";

export const dynamic = "force-dynamic";

export default async function DiscoverPage() {
  const model = await getDiscoveryPageReadModel().catch(() => ({
    recent: [],
    gems: [],
    rising: [],
    revived: [],
    surprisePool: [],
  }));
  return (
    <>
      <PageHeader
        eyebrow="Discovery / serendipity"
        title="Find the signal before the crowd"
        description="A discovery surface tuned for useful surprise: healthy lower-visibility projects, new additions, revivals, and strong early signals."
        aside={
          <SurpriseButton
            repositories={[
              ...model.surprisePool.map((entry) => entry.repository),
              ...model.recent.filter((repository) => repository.observedAt !== null),
            ].map((repository) => repository.fullName)}
          />
        }
      />
      <section className="shell content-section discover-grid">
        <article className="discover-feature">
          <div>
            <p className="eyebrow">Discovery principle</p>
            <h2>Visibility is not quality.</h2>
            <p>
              ForgeRank looks for the difference between attention already accumulated and evidence
              developing now.
            </p>
            <Link href="/methodology">
              How Hidden Gems work <ArrowRight size={14} />
            </Link>
          </div>
          <Compass size={94} />
        </article>
        <DiscoverSection
          icon={Gem}
          title="Hidden gems"
          description="High normalized health, momentum, engineering, and community evidence below a 25k-star visibility ceiling."
          repositories={model.gems.map((entry) => entry.repository)}
          empty="Hidden Gems needs at least three observations plus positive momentum, health, and engineering evidence."
        />
        <DiscoverSection
          icon={Sprout}
          title="Growing fast"
          description="Positive relative growth balanced with velocity and Git-derived activity."
          repositories={model.rising.map((entry) => entry.repository)}
          empty="Rising projects require at least two comparable observations."
        />
        <DiscoverSection
          icon={Sprout}
          title="Recently discovered"
          description="Repositories newly admitted to ForgeRank's relevance-driven index."
          repositories={model.recent.slice(0, 6)}
          empty="No seed identifiers have been loaded."
        />
        <DiscoverSection
          icon={History}
          title="Recently revived"
          description="Sustained renewed activity after a measurable quiet period."
          repositories={model.revived.map((entry) => entry.repository)}
          empty="Revival detection requires a longer Git activity baseline."
        />
      </section>
    </>
  );
}

function DiscoverSection({
  icon: Icon,
  title,
  description,
  repositories,
  empty,
}: {
  icon: typeof Gem;
  title: string;
  description: string;
  repositories: Awaited<ReturnType<typeof getDiscoveryPageReadModel>>["recent"];
  empty: string;
}) {
  return (
    <section className="discover-section">
      <div className="section-heading compact-heading">
        <div>
          <p className="eyebrow">
            <Icon size={11} /> Curated by signal
          </p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {repositories.length > 0 ? (
        <div className="repository-grid">
          {repositories.map((repository, index) => (
            <RepositoryCard
              key={repository.id}
              repository={repository}
              index={index}
              variant="compact"
            />
          ))}
        </div>
      ) : (
        <InsufficientData action={false} detail={empty} />
      )}
    </section>
  );
}
