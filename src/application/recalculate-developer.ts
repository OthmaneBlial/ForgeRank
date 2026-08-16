import { and, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";

import { analyzeDeveloperPortfolio } from "@/domain/developer-intelligence";
import {
  calculateDeveloperScore,
  deriveDeveloperScoreConfidence,
} from "@/domain/scoring/developer-score";
import type { Confidence } from "@/domain/confidence";
import { getDatabase } from "@/infrastructure/db/client";
import {
  developerSnapshots,
  developers,
  gitAnalyses,
  repositories,
} from "@/infrastructure/db/schema";

export async function recalculateDeveloper(developerId: string): Promise<void> {
  const database = await getDatabase();
  const [developer] = await database
    .select()
    .from(developers)
    .where(eq(developers.id, developerId))
    .limit(1);
  if (!developer) throw new Error(`Unknown developer ${developerId}`);
  const owned = await database
    .select()
    .from(repositories)
    .where(
      and(
        eq(sql`lower(${repositories.owner})`, developer.canonicalUsername),
        ne(repositories.isFork, true),
        isNotNull(repositories.lastSuccessfulFetchAt),
      ),
    );
  const repositoryIds = owned.map((repository) => repository.id);
  const analyses =
    repositoryIds.length === 0
      ? []
      : await database
          .selectDistinctOn([gitAnalyses.repositoryId])
          .from(gitAnalyses)
          .where(inArray(gitAnalyses.repositoryId, repositoryIds))
          .orderBy(gitAnalyses.repositoryId, desc(gitAnalyses.analyzedAt));
  const analysisByRepository = new Map(
    analyses.map((analysis) => [analysis.repositoryId, analysis]),
  );
  const intelligence = analyzeDeveloperPortfolio(
    owned.map((repository) => {
      const analysis = analysisByRepository.get(repository.id);
      return {
        repositoryId: repository.id,
        fullName: repository.fullName,
        primaryLanguage: repository.primaryLanguage,
        stars: repository.currentStars,
        analyzedAt: analysis?.analyzedAt ?? null,
        latestCommitAt: analysis?.latestCommitAt ?? null,
        commits30d: analysis?.commits30d ?? null,
        commits90d: analysis?.commits90d ?? null,
        activeWeeks12: analysis?.activeWeeks12 ?? null,
        uniqueAuthors90d: analysis?.uniqueAuthors90d ?? null,
        topContributorShare:
          analysis?.topContributorShare === null || analysis?.topContributorShare === undefined
            ? null
            : Number(analysis.topContributorShare),
      };
    }),
  );
  const scores = owned
    .map((repository) =>
      repository.currentScore === null ? null : Number(repository.currentScore),
    )
    .filter((score): score is number => score !== null);
  const ownedStars = owned.some((repository) => repository.currentStars !== null)
    ? owned.reduce((sum, repository) => sum + (repository.currentStars ?? 0), 0)
    : null;
  const languageCount = new Set(
    owned.map((repository) => repository.primaryLanguage).filter(Boolean),
  ).size;
  const profileConfidence = developer.metadataConfidence as Confidence;
  const scoreSignals = {
    ownedOriginalStars: ownedStars,
    ownedRepositoryCount: owned.length,
    averageRepositoryScore:
      scores.length > 0 ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null,
    activeOwnedRepositoryCount: intelligence.activeRepositoryCount,
    collaborationRepositoryCount: intelligence.collaborativeRepositoryCount,
    activeMonths12: null,
    languageCount: owned.length > 0 ? languageCount : null,
    confidence: profileConfidence,
  };
  const scoreConfidence = deriveDeveloperScoreConfidence(scoreSignals);
  const score = calculateDeveloperScore({ ...scoreSignals, confidence: scoreConfidence });
  const [latest] = await database
    .select()
    .from(developerSnapshots)
    .where(eq(developerSnapshots.developerId, developerId))
    .orderBy(desc(developerSnapshots.observedAt))
    .limit(1);
  await database.transaction(async (transaction) => {
    await transaction
      .update(developers)
      .set({
        currentScore: owned.length === 0 ? null : String(score.total),
        scoreConfidence,
        scoreVersion: score.version,
        scoreCalculatedAt: new Date(),
      })
      .where(eq(developers.id, developerId));
    if (latest)
      await transaction
        .update(developerSnapshots)
        .set({
          repositoriesIndexed: owned.length,
          ownedOriginalStars: ownedStars,
          forgeScore: owned.length === 0 ? null : String(score.total),
          impactScore: String(score.impact),
          consistencyScore: String(score.consistency),
          collaborationScore: String(score.collaboration),
          projectQualityScore: String(score.projectQuality),
          breadthScore: String(score.breadth),
          trustScore: String(score.trust),
          scoreVersion: score.version,
        })
        .where(eq(developerSnapshots.id, latest.id));
  });
}
