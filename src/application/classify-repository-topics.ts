import { desc, eq } from "drizzle-orm";

import { classifyTopics } from "@/domain/topics";
import { getDatabase } from "@/infrastructure/db/client";
import { gitAnalyses, repositories, repositoryTopics } from "@/infrastructure/db/schema";

export async function classifyRepositoryTopics(repositoryId: string): Promise<number> {
  const database = await getDatabase();
  const [repository] = await database
    .select()
    .from(repositories)
    .where(eq(repositories.id, repositoryId))
    .limit(1);
  if (!repository) return 0;
  const [analysis] = await database
    .select()
    .from(gitAnalyses)
    .where(eq(gitAnalyses.repositoryId, repositoryId))
    .orderBy(desc(gitAnalyses.analyzedAt))
    .limit(1);
  const technologies = analysis?.detectedTechnologies?.map((technology) => technology.name) ?? [];
  const classifications = classifyTopics({ description: repository.description, technologies });
  await database.transaction(async (transaction) => {
    await transaction
      .delete(repositoryTopics)
      .where(eq(repositoryTopics.repositoryId, repositoryId));
    if (classifications.length > 0)
      await transaction.insert(repositoryTopics).values(
        classifications.map((classification) => ({
          repositoryId,
          topicSlug: classification.slug,
          confidence: classification.confidence,
          evidence: classification.evidence,
        })),
      );
  });
  return classifications.length;
}
