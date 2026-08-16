import { readFile } from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDatabase } from "@/infrastructure/db/client";
import { collectionRepositories, collections, repositories } from "@/infrastructure/db/schema";
import { topics } from "@/infrastructure/db/schema";
import { discoverRepository } from "@/infrastructure/db/repository-store";
import { parseGitHubRepositoryInput } from "@/infrastructure/github-public/url";
import { TOPIC_DEFINITIONS } from "@/domain/topics";
import { discoverDeveloper } from "@/infrastructure/db/developer-store";

const collectionSchema = z.array(
  z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1),
    description: z.string().min(1),
    repositories: z.array(z.string()),
  }),
);

export async function seedIdentifiers(): Promise<{
  repositories: number;
  developers: number;
  collections: number;
  topics: number;
}> {
  const seedRoot = path.join(process.cwd(), "data", "seeds");
  const repositoryInputs = z
    .array(z.string())
    .parse(JSON.parse(await readFile(path.join(seedRoot, "repositories.json"), "utf8")));
  const collectionInputs = collectionSchema.parse(
    JSON.parse(await readFile(path.join(seedRoot, "collections.json"), "utf8")),
  );
  const developerInputs = z
    .array(z.string())
    .parse(JSON.parse(await readFile(path.join(seedRoot, "developers.json"), "utf8")));
  const database = await getDatabase();

  for (const input of repositoryInputs) {
    const identity = parseGitHubRepositoryInput(input);
    await discoverRepository(identity);
  }
  for (const username of developerInputs) await discoverDeveloper(username);

  for (const topic of TOPIC_DEFINITIONS) {
    await database
      .insert(topics)
      .values({ slug: topic.slug, name: topic.name, description: topic.description })
      .onConflictDoUpdate({
        target: topics.slug,
        set: { name: topic.name, description: topic.description },
      });
  }

  for (const collection of collectionInputs) {
    await database
      .insert(collections)
      .values({
        slug: collection.slug,
        name: collection.name,
        description: collection.description,
      })
      .onConflictDoUpdate({
        target: collections.slug,
        set: { name: collection.name, description: collection.description, updatedAt: new Date() },
      });

    for (const [position, fullName] of collection.repositories.entries()) {
      const [repository] = await database
        .select({ id: repositories.id })
        .from(repositories)
        .where(eq(repositories.canonicalKey, `github.com/${fullName}`.toLowerCase()))
        .limit(1);
      if (!repository) continue;
      await database
        .insert(collectionRepositories)
        .values({ collectionSlug: collection.slug, repositoryId: repository.id, position })
        .onConflictDoUpdate({
          target: [collectionRepositories.collectionSlug, collectionRepositories.repositoryId],
          set: { position },
        });
    }
  }

  return {
    repositories: repositoryInputs.length,
    developers: developerInputs.length,
    collections: collectionInputs.length,
    topics: TOPIC_DEFINITIONS.length,
  };
}
