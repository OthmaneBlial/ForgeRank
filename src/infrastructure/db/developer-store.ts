import { and, asc, desc, eq, inArray, isNotNull } from "drizzle-orm";

import type { DeveloperSnapshotInput } from "@/domain/developer";
import { applyDeveloperProfileEvents } from "@/domain/developer-profile";
import { getDatabase } from "./client";
import { developerProfileEvents, developerSnapshots, developers } from "./schema";

export async function discoverDeveloper(username: string) {
  const database = await getDatabase();
  const [developer] = await database
    .insert(developers)
    .values({
      username,
      canonicalUsername: username.toLowerCase(),
      sourceUrl: `https://github.com/${encodeURIComponent(username)}`,
    })
    .onConflictDoUpdate({
      target: developers.canonicalUsername,
      set: { username, sourceUrl: `https://github.com/${encodeURIComponent(username)}` },
    })
    .returning();
  if (!developer) throw new Error(`Failed to discover developer ${username}`);
  return developer;
}

export async function persistDeveloperSnapshot(input: DeveloperSnapshotInput): Promise<string> {
  const database = await getDatabase();
  return database.transaction(async (transaction) => {
    const [developer] = await transaction
      .insert(developers)
      .values({
        username: input.username,
        canonicalUsername: input.username.toLowerCase(),
        displayName: input.displayName,
        bio: input.bio,
        location: input.location,
        avatarUrl: input.avatarUrl,
        sourceUrl: input.sourceUrl,
        lastIndexedAt: input.observedAt,
        parserVersion: input.parserVersion,
        metadataConfidence: input.confidence,
        scoreConfidence: "INSUFFICIENT",
      })
      .onConflictDoUpdate({
        target: developers.canonicalUsername,
        set: {
          username: input.username,
          displayName: input.displayName,
          bio: input.bio,
          location: input.location,
          avatarUrl: input.avatarUrl,
          sourceUrl: input.sourceUrl,
          lastIndexedAt: input.observedAt,
          parserVersion: input.parserVersion,
          metadataConfidence: input.confidence,
        },
      })
      .returning({ id: developers.id });
    if (!developer) throw new Error(`Failed to persist developer ${input.username}`);
    await transaction
      .insert(developerSnapshots)
      .values({
        developerId: developer.id,
        observedAt: input.observedAt,
        confidence: input.confidence,
        parserVersion: input.parserVersion,
        provenance: {
          profile: {
            source: "github_public_profile_page",
            observedAt: input.observedAt.toISOString(),
            parserVersion: input.parserVersion,
          },
        },
      })
      .onConflictDoNothing();
    return developer.id;
  });
}

export async function getDeveloperSnapshots(developerId: string) {
  const database = await getDatabase();
  return database
    .select()
    .from(developerSnapshots)
    .where(eq(developerSnapshots.developerId, developerId))
    .orderBy(asc(developerSnapshots.observedAt));
}

export async function listDevelopers(limit = 100) {
  const database = await getDatabase();
  const rows = await database
    .select()
    .from(developers)
    .where(and(isNotNull(developers.lastIndexedAt), eq(developers.visibility, "PUBLIC")))
    .orderBy(desc(developers.currentScore), asc(developers.username))
    .limit(Math.min(limit, 100));
  return applyDeveloperProfileCorrections(rows);
}

export async function applyDeveloperProfileCorrections<
  T extends { id: string; displayName: string | null; bio: string | null; location: string | null },
>(rows: T[]): Promise<T[]> {
  if (rows.length === 0) return rows;
  const database = await getDatabase();
  const events = await database
    .select()
    .from(developerProfileEvents)
    .where(
      inArray(
        developerProfileEvents.developerId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(developerProfileEvents.createdAt));
  return rows.map((row) =>
    applyDeveloperProfileEvents(
      row,
      events.filter((event) => event.developerId === row.id),
    ),
  );
}

export async function applyDeveloperDisplayNameCorrections<
  T extends { id: string; displayName: string | null },
>(rows: T[]): Promise<T[]> {
  if (rows.length === 0) return rows;
  const database = await getDatabase();
  const events = await database
    .select()
    .from(developerProfileEvents)
    .where(
      and(
        inArray(
          developerProfileEvents.developerId,
          rows.map((row) => row.id),
        ),
        eq(developerProfileEvents.field, "DISPLAY_NAME"),
      ),
    )
    .orderBy(asc(developerProfileEvents.createdAt));
  return rows.map((row) => {
    const corrected = applyDeveloperProfileEvents(
      { displayName: row.displayName, bio: null, location: null },
      events.filter((event) => event.developerId === row.id),
    );
    return { ...row, displayName: corrected.displayName };
  });
}
