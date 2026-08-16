export type DeveloperPortfolioRepositoryEvidence = {
  repositoryId: string;
  fullName: string;
  primaryLanguage: string | null;
  stars: number | null;
  analyzedAt: Date | null;
  latestCommitAt: Date | null;
  commits30d: number | null;
  commits90d: number | null;
  activeWeeks12: number | null;
  uniqueAuthors90d: number | null;
  topContributorShare: number | null;
};

export type DeveloperPortfolioIntelligence = {
  repositoryCount: number;
  analyzedRepositoryCount: number;
  collaborationCoverage: number;
  collaborativeRepositoryCount: number | null;
  activeRepositoryCount: number | null;
  totalCommits30d: number | null;
  totalCommits90d: number | null;
  averageActiveWeeks12: number | null;
  averageTopContributorShare: number | null;
  authorRepositoryPresences90d: number | null;
  latestCommitAt: Date | null;
  strongestLanguage: string | null;
  languages: Array<{ name: string; repositories: number; stars: number }>;
};

export function analyzeDeveloperPortfolio(
  repositories: DeveloperPortfolioRepositoryEvidence[],
): DeveloperPortfolioIntelligence {
  const analyzed = repositories.filter((repository) => repository.analyzedAt !== null);
  const collaborationKnown = repositories.filter(
    (repository) => repository.uniqueAuthors90d !== null,
  );
  const activityKnown = repositories.filter((repository) => repository.commits90d !== null);
  const languages = new Map<string, { name: string; repositories: number; stars: number }>();
  for (const repository of repositories) {
    if (!repository.primaryLanguage) continue;
    const key = repository.primaryLanguage.toLowerCase();
    const current = languages.get(key) ?? {
      name: repository.primaryLanguage,
      repositories: 0,
      stars: 0,
    };
    current.repositories += 1;
    current.stars += repository.stars ?? 0;
    languages.set(key, current);
  }
  const languageBreakdown = [...languages.values()].toSorted(
    (left, right) =>
      right.repositories - left.repositories ||
      right.stars - left.stars ||
      left.name.localeCompare(right.name),
  );
  return {
    repositoryCount: repositories.length,
    analyzedRepositoryCount: analyzed.length,
    collaborationCoverage: collaborationKnown.length,
    collaborativeRepositoryCount:
      collaborationKnown.length === 0
        ? null
        : collaborationKnown.filter((repository) => (repository.uniqueAuthors90d ?? 0) > 1).length,
    activeRepositoryCount:
      activityKnown.length === 0
        ? null
        : activityKnown.filter((repository) => (repository.commits90d ?? 0) > 0).length,
    totalCommits30d: sumOrNull(repositories.map((repository) => repository.commits30d)),
    totalCommits90d: sumOrNull(repositories.map((repository) => repository.commits90d)),
    averageActiveWeeks12: average(repositories.map((repository) => repository.activeWeeks12)),
    averageTopContributorShare: average(
      repositories.map((repository) => repository.topContributorShare),
    ),
    authorRepositoryPresences90d: sumOrNull(
      repositories.map((repository) => repository.uniqueAuthors90d),
    ),
    latestCommitAt: latest(repositories.map((repository) => repository.latestCommitAt)),
    strongestLanguage: languageBreakdown[0]?.name ?? null,
    languages: languageBreakdown,
  };
}

function average(values: Array<number | null>): number | null {
  const available = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  if (available.length === 0) return null;
  return (
    Math.round((available.reduce((total, value) => total + value, 0) / available.length) * 10) / 10
  );
}

function sumOrNull(values: Array<number | null>): number | null {
  const available = values.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  return available.length === 0 ? null : available.reduce((total, value) => total + value, 0);
}

function latest(values: Array<Date | null>): Date | null {
  const available = values.filter((value): value is Date => value !== null);
  return available.length === 0
    ? null
    : new Date(Math.max(...available.map((value) => value.getTime())));
}
