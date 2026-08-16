import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { getLanguageEcosystemHistory } from "@/application/read-model";
import { GrowthChart } from "@/components/data/growth-chart";
import { listRepositories } from "@/infrastructure/db/repository-store";
import { RepositoryTable } from "@/components/data/repository-table";
import { InsufficientData } from "@/components/data/empty-state";
import { PageHeader } from "@/components/shell/page-header";

export const dynamic = "force-dynamic";

const aliases: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
  rust: "Rust",
  go: "Go",
  java: "Java",
  kotlin: "Kotlin",
  swift: "Swift",
  "c-plus-plus": "C++",
  "c-sharp": "C#",
  php: "PHP",
  ruby: "Ruby",
  dart: "Dart",
  shell: "Shell",
};

export default async function LanguagePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const language =
    aliases[slug] ??
    slug
      .split("-")
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(" ");
  let repositories = [] as Awaited<ReturnType<typeof listRepositories>>;
  try {
    repositories = await listRepositories({ language, sort: "score", limit: 50 });
  } catch {
    /* empty below */
  }
  const history = await getLanguageEcosystemHistory(slug);
  const latestHistory = history.at(-1) ?? null;
  return (
    <>
      <PageHeader
        eyebrow="Indexed ecosystem / language"
        title={language}
        description={`Momentum, established leaders, and rising projects within ForgeRank's indexed ${language} repositories.`}
      />
      <section className="shell content-section">
        <div className="language-summary">
          <div>
            <span>Indexed projects</span>
            <strong>{repositories.length}</strong>
          </div>
          <div>
            <span>Momentum coverage</span>
            <strong>
              {repositories.filter((repository) => repository.momentum !== null).length}
            </strong>
          </div>
          <div>
            <span>Ranking scope</span>
            <strong>ForgeRank index</strong>
          </div>
          <Link href="/methodology">
            Methodology <ArrowRight size={13} />
          </Link>
        </div>
        <section className="language-history-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Historical ecosystem snapshots</span>
              <h2>Indexed attention over time</h2>
            </div>
            <p>
              {history.length} persisted observation{history.length === 1 ? "" : "s"}
              {latestHistory
                ? ` · latest ${latestHistory.observedAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}`
                : ""}
            </p>
          </div>
          <GrowthChart
            points={history.map((snapshot) => ({
              observedAt: snapshot.observedAt,
              stars: snapshot.totalStars,
            }))}
          />
          {history.length < 2 && (
            <InsufficientData
              action={false}
              detail={`ForgeRank has ${history.length} persisted ${language} ecosystem snapshot${history.length === 1 ? "" : "s"}. A trend requires at least two observations; no historical values are reconstructed.`}
            />
          )}
        </section>
        {repositories.length > 0 ? (
          <RepositoryTable repositories={repositories} />
        ) : (
          <InsufficientData
            title={`No observed ${language} repositories yet.`}
            detail="Seed identifiers do not receive a language until the public document parser observes it."
          />
        )}
      </section>
    </>
  );
}
