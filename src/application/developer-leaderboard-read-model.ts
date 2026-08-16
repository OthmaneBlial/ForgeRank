import { and, desc, inArray, isNotNull, ne, sql } from "drizzle-orm";

import {
  developerArchetypes,
  rankDeveloperLeaderboard,
  type DeveloperActivityWindow,
  type DeveloperArchetype,
  type DeveloperLeaderboardCandidate,
  type DeveloperLeaderboardCategory,
} from "@/domain/developer-leaderboard";
import { analyzeDeveloperPortfolio } from "@/domain/developer-intelligence";
import { getDatabase } from "@/infrastructure/db/client";
import { listDevelopers } from "@/infrastructure/db/developer-store";
import { developerSnapshots, gitAnalyses, repositories } from "@/infrastructure/db/schema";

const DAY_MS = 24 * 60 * 60 * 1_000;

type DeveloperRow = Awaited<ReturnType<typeof listDevelopers>>[number];

export interface DeveloperLeaderboardViewCandidate extends DeveloperLeaderboardCandidate {
  developer: DeveloperRow;
  archetypes: ReturnType<typeof developerArchetypes>;
}

export interface DeveloperLeaderboardRequest {
  category: DeveloperLeaderboardCategory;
  ecosystem?: string;
  location?: string;
  activityWindow: DeveloperActivityWindow;
  archetype: DeveloperArchetype;
}

function numberOrNull(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))].toSorted(
    (left, right) => left.localeCompare(right),
  );
}

export async function getDeveloperLeaderboardReadModel(request: DeveloperLeaderboardRequest) {
  const publicDevelopers = await listDevelopers(100);
  if (publicDevelopers.length === 0) {
    return {
      entries: [],
      candidates: [],
      options: { ecosystems: [], locations: [] },
      coverage: { confirmed: 0, scored: 0, portfolios: 0, gitAnalyzed: 0, historical: 0 },
    };
  }

  const database = await getDatabase();
  const developerIds = publicDevelopers.map((developer) => developer.id);
  const canonicalUsernames = publicDevelopers.map((developer) => developer.canonicalUsername);
  const [snapshotRows, ownedRepositories] = await Promise.all([
    database
      .select()
      .from(developerSnapshots)
      .where(inArray(developerSnapshots.developerId, developerIds))
      .orderBy(developerSnapshots.developerId, desc(developerSnapshots.observedAt)),
    database
      .select()
      .from(repositories)
      .where(
        and(
          inArray(sql<string>`lower(${repositories.owner})`, canonicalUsernames),
          ne(repositories.isFork, true),
          isNotNull(repositories.lastSuccessfulFetchAt),
        ),
      ),
  ]);

  const repositoryIds = ownedRepositories.map((repository) => repository.id);
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
  const snapshotsByDeveloper = new Map<string, typeof snapshotRows>();
  for (const snapshot of snapshotRows) {
    snapshotsByDeveloper.set(snapshot.developerId, [
      ...(snapshotsByDeveloper.get(snapshot.developerId) ?? []),
      snapshot,
    ]);
  }

  const candidates: DeveloperLeaderboardViewCandidate[] = publicDevelopers.map((developer) => {
    const owned = ownedRepositories.filter(
      (repository) => repository.owner.toLocaleLowerCase() === developer.canonicalUsername,
    );
    const portfolio = analyzeDeveloperPortfolio(
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
          topContributorShare: numberOrNull(analysis?.topContributorShare),
        };
      }),
    );
    const snapshots = snapshotsByDeveloper.get(developer.id) ?? [];
    const latest = snapshots.find((snapshot) => snapshot.forgeScore !== null) ?? snapshots[0];
    const baseline = latest
      ? snapshots.find(
          (snapshot) =>
            snapshot.forgeScore !== null &&
            snapshot.observedAt.getTime() <= latest.observedAt.getTime() - 30 * DAY_MS,
        )
      : undefined;
    const latestScore = numberOrNull(latest?.forgeScore);
    const baselineScore = numberOrNull(baseline?.forgeScore);
    const oldestRepository = owned
      .map((repository) => repository.repositoryCreatedAt)
      .filter((value): value is Date => value !== null)
      .toSorted((left, right) => left.getTime() - right.getTime())[0];

    const candidate: DeveloperLeaderboardViewCandidate = {
      id: developer.id,
      username: developer.username,
      location: developer.location,
      ecosystems: portfolio.languages.map((language) => language.name),
      currentScore: numberOrNull(developer.currentScore),
      impactScore: numberOrNull(latest?.impactScore),
      consistencyScore: numberOrNull(latest?.consistencyScore),
      collaborationScore: numberOrNull(latest?.collaborationScore),
      projectQualityScore: numberOrNull(latest?.projectQualityScore),
      breadthScore: numberOrNull(latest?.breadthScore),
      repositoryCount: portfolio.repositoryCount,
      activeRepositoryCount: portfolio.activeRepositoryCount,
      collaborativeRepositoryCount: portfolio.collaborativeRepositoryCount,
      collaborationCoverage: portfolio.collaborationCoverage,
      commits30d: portfolio.totalCommits30d,
      commits90d: portfolio.totalCommits90d,
      scoreChange30d:
        latestScore === null || baselineScore === null
          ? null
          : Math.round((latestScore - baselineScore) * 10) / 10,
      portfolioAgeDays: oldestRepository
        ? Math.max(0, Math.floor((Date.now() - oldestRepository.getTime()) / DAY_MS))
        : null,
      developer,
      archetypes: [],
    };
    candidate.archetypes = developerArchetypes(candidate);
    return candidate;
  });

  return {
    entries: rankDeveloperLeaderboard(candidates, request),
    candidates,
    options: {
      ecosystems: uniqueSorted(candidates.flatMap((candidate) => candidate.ecosystems)),
      locations: uniqueSorted(candidates.map((candidate) => candidate.location)),
    },
    coverage: {
      confirmed: candidates.length,
      scored: candidates.filter((candidate) => candidate.currentScore !== null).length,
      portfolios: candidates.filter((candidate) => candidate.repositoryCount > 0).length,
      gitAnalyzed: candidates.filter(
        (candidate) => candidate.commits90d !== null || candidate.collaborationCoverage > 0,
      ).length,
      historical: candidates.filter((candidate) => candidate.scoreChange30d !== null).length,
    },
  };
}
