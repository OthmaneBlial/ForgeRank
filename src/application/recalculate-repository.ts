import { desc, eq } from "drizzle-orm";

import { calculateRepositoryScore } from "@/domain/scoring/repository-score";
import { classifyMaturity } from "@/domain/scoring/maturity";
import { calculateTrend } from "@/domain/trending";
import type { Confidence } from "@/domain/confidence";
import { getDatabase } from "@/infrastructure/db/client";
import { gitAnalyses, repositories, repositorySnapshots } from "@/infrastructure/db/schema";

const numeric = (value: string | null): number | null => (value === null ? null : Number(value));

export async function recalculateRepository(repositoryId: string): Promise<void> {
  const database = await getDatabase();
  const [repository] = await database
    .select()
    .from(repositories)
    .where(eq(repositories.id, repositoryId))
    .limit(1);
  if (!repository) throw new Error(`Unknown repository ${repositoryId}`);

  const snapshots = await database
    .select()
    .from(repositorySnapshots)
    .where(eq(repositorySnapshots.repositoryId, repositoryId))
    .orderBy(repositorySnapshots.observedAt);
  if (snapshots.length === 0) {
    await database
      .update(repositories)
      .set({
        currentScore: null,
        currentMomentumScore: null,
        currentHealthScore: null,
        currentCommunityScore: null,
        currentEngineeringScore: null,
        scoreReasons: [],
        scoreConfidence: "INSUFFICIENT",
        scoreVersion: null,
        scoreCalculatedAt: null,
        maturity: null,
        rank: null,
        previousRank: null,
      })
      .where(eq(repositories.id, repositoryId));
    return;
  }
  const [gitAnalysis] = await database
    .select()
    .from(gitAnalyses)
    .where(eq(gitAnalyses.repositoryId, repositoryId))
    .orderBy(desc(gitAnalyses.analyzedAt))
    .limit(1);

  const recentTrend = calculateTrend(
    snapshots
      .filter((snapshot) => snapshot.stars !== null)
      .map((snapshot) => ({
        observedAt: snapshot.observedAt,
        stars: snapshot.stars ?? 0,
        forks: snapshot.forks,
      })),
    30,
  );
  const ageDays = repository.repositoryCreatedAt
    ? Math.floor((Date.now() - repository.repositoryCreatedAt.getTime()) / (24 * 60 * 60 * 1_000))
    : null;
  const daysSinceLastCommit = gitAnalysis?.latestCommitAt
    ? Math.floor((Date.now() - gitAnalysis.latestCommitAt.getTime()) / (24 * 60 * 60 * 1_000))
    : null;
  const quality = gitAnalysis?.qualitySignals ?? {};
  const confidence = repository.metadataConfidence as Confidence;
  const score = calculateRepositoryScore({
    stars: repository.currentStars,
    forks: repository.currentForks,
    ageDays,
    starGrowth30d: recentTrend.absoluteGrowth,
    starGrowthPrevious30d: null,
    activeWeeks12: gitAnalysis?.activeWeeks12 ?? null,
    daysSinceLastCommit,
    uniqueAuthors90d: gitAnalysis?.uniqueAuthors90d ?? null,
    topContributorShare: numeric(gitAnalysis?.topContributorShare ?? null),
    hasReadme: quality.readme ?? null,
    hasLicense: repository.license !== null || quality.license === true,
    hasTests: quality.tests ?? null,
    hasCi: quality.ci ?? null,
    isFork: repository.isFork,
    isArchived: repository.isArchived,
    anomalyCount: recentTrend.anomaly ? 1 : 0,
    confidence,
  });

  const maturity = classifyMaturity({
    ageDays,
    daysSinceLastCommit,
    activeWeeks12: gitAnalysis?.activeWeeks12 ?? null,
    growth30d: recentTrend.absoluteGrowth,
    previousDormantPeriodDays: gitAnalysis?.previousDormantPeriodDays ?? null,
  });

  await database.transaction(async (transaction) => {
    await transaction
      .update(repositories)
      .set({
        currentScore: String(score.total),
        currentMomentumScore: recentTrend.score === null ? null : String(recentTrend.score),
        currentHealthScore: String(score.health),
        currentCommunityScore: String(score.community),
        currentEngineeringScore: String(score.engineering),
        scoreReasons: score.reasons,
        scoreConfidence: score.confidence,
        scoreVersion: score.version,
        scoreCalculatedAt: new Date(),
        maturity,
        lastActivityAt: gitAnalysis?.latestCommitAt ?? repository.lastActivityAt,
      })
      .where(eq(repositories.id, repositoryId));

    const latestSnapshot = snapshots.at(-1);
    if (latestSnapshot) {
      await transaction
        .update(repositorySnapshots)
        .set({
          forgeScore: String(score.total),
          impactScore: String(score.impact),
          momentumScore: String(score.momentum),
          healthScore: String(score.health),
          communityScore: String(score.community),
          engineeringScore: String(score.engineering),
          trustScore: String(score.trust),
          scoreVersion: score.version,
          scoreReasons: score.reasons,
          anomalyFlags: recentTrend.anomaly ? [recentTrend.anomaly] : [],
        })
        .where(eq(repositorySnapshots.id, latestSnapshot.id));
    }
  });
}
