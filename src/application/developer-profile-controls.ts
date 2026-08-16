import { eq } from "drizzle-orm";

import {
  validateAuditReason,
  validateDeveloperProfileCorrection,
  type DeveloperVisibility,
} from "@/domain/developer-profile";
import { getDatabase } from "@/infrastructure/db/client";
import { developerProfileEvents, developers } from "@/infrastructure/db/schema";
import { parseGitHubUsername } from "@/infrastructure/github-public/developer-url";

export async function setDeveloperProfileVisibility(
  usernameInput: string,
  visibility: DeveloperVisibility,
  reasonInput: string,
) {
  const { username } = parseGitHubUsername(usernameInput);
  const reason = validateAuditReason(reasonInput);
  const database = await getDatabase();
  const [developer] = await database
    .select()
    .from(developers)
    .where(eq(developers.canonicalUsername, username.toLowerCase()))
    .limit(1);
  if (!developer) throw new Error(`Unknown developer ${username}.`);
  const changedAt = new Date();
  await database.transaction(async (transaction) => {
    await transaction
      .update(developers)
      .set({ visibility, visibilityUpdatedAt: changedAt, visibilityReason: reason })
      .where(eq(developers.id, developer.id));
    await transaction.insert(developerProfileEvents).values({
      developerId: developer.id,
      action: visibility === "HIDDEN" ? "HIDE_PROFILE" : "SHOW_PROFILE",
      reason,
      createdAt: changedAt,
    });
  });
  return { username: developer.username, visibility, changedAt };
}

export async function recordDeveloperProfileCorrection(input: {
  username: string;
  field: string;
  action: string;
  value?: string | null;
  reason: string;
}) {
  const { username } = parseGitHubUsername(input.username);
  const correction = validateDeveloperProfileCorrection(input);
  const database = await getDatabase();
  const [developer] = await database
    .select()
    .from(developers)
    .where(eq(developers.canonicalUsername, username.toLowerCase()))
    .limit(1);
  if (!developer) throw new Error(`Unknown developer ${username}.`);
  const [event] = await database
    .insert(developerProfileEvents)
    .values({ developerId: developer.id, ...correction })
    .returning();
  if (!event) throw new Error("Failed to record developer correction.");
  return { username: developer.username, event };
}
