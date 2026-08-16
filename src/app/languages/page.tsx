import { ArrowRight, Braces, Database, GitBranch, Radar } from "lucide-react";
import Link from "next/link";

import { getLanguageReadModels } from "@/application/read-model";
import { InsufficientData } from "@/components/data/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { formatCompactNumber } from "@/domain/format";

export const dynamic = "force-dynamic";

export default async function LanguagesPage() {
  const languages = await getLanguageReadModels();
  return (
    <>
      <PageHeader
        eyebrow="Ecosystems / languages"
        title="Languages on the move"
        description="A view of ForgeRank's indexed repository universe—not a claim about global language market share."
      />
      <section className="shell content-section">
        {languages.length > 0 ? (
          <div className="language-grid">
            {languages.map((language, index) => (
              <Link
                key={language.name}
                href={`/language/${language.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                className="language-card"
              >
                <div className="language-card-head">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <Braces size={18} />
                </div>
                <h2>{language.name}</h2>
                <div className="language-stats">
                  <span>
                    <Database size={12} /> {language.repositoryCount} indexed
                  </span>
                  <span>
                    <GitBranch size={12} /> {formatCompactNumber(language.totalStars)} stars
                  </span>
                  <span>
                    <Radar size={12} />{" "}
                    {language.averageMomentum === null
                      ? "Momentum pending"
                      : `${language.averageMomentum} momentum`}
                  </span>
                </div>
                <strong>Average ForgeRank {language.averageScore ?? "—"}</strong>
                <ArrowRight size={15} />
              </Link>
            ))}
          </div>
        ) : (
          <InsufficientData
            title="No language aggregates are available."
            detail="Language pages are calculated only from repositories whose public metadata exposed a primary language."
          />
        )}
      </section>
    </>
  );
}
