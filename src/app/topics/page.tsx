import { ArrowRight, Boxes } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shell/page-header";
import { getTopicsReadModel } from "@/application/read-model";

export const dynamic = "force-dynamic";

export default async function TopicsPage() {
  const topics = await getTopicsReadModel();
  return (
    <>
      <PageHeader
        eyebrow="Ecosystems / multi-label taxonomy"
        title="Projects cross boundaries"
        description="Deterministic topic and content heuristics let one repository belong to several ecosystems. Counts appear only after classification evidence exists."
      />
      <section className="shell content-section">
        <div className="topic-grid">
          {topics.map((topic, index) => (
            <Link key={topic.slug} href={`/topic/${topic.slug}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <Boxes size={17} />
              <strong>{topic.name}</strong>
              <small>
                {topic.repositoryCount === 0
                  ? "Classification coverage pending"
                  : `${topic.repositoryCount} classified repositories`}
              </small>
              <ArrowRight size={14} />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
