import { z } from "zod";

import { IndexRepositoryService } from "@/application/index-repository";
import { IndexDeveloperService } from "@/application/index-developer";
import { recalculateRepository } from "@/application/recalculate-repository";
import { refreshRepositoryRankings } from "@/application/refresh-rankings";
import { GitInspector } from "@/infrastructure/git/inspector";
import { classifyRepositoryTopics } from "@/application/classify-repository-topics";
import { PublicDocumentFetchError } from "@/infrastructure/github-public/fetcher";
import type { CrawlJob } from "@/infrastructure/queue/job-queue";
import { enqueueJob } from "@/infrastructure/queue/job-queue";
import { scheduleRepositoryRefreshes } from "@/application/schedule-refreshes";
import { maintainSnapshots } from "@/application/maintain-snapshots";

const repositoryPayload = z.object({
  repositoryId: z.string().uuid(),
  fullName: z.string().min(3),
});
const developerPayload = z.object({ username: z.string().min(1).max(39) });

export async function processJob(job: CrawlJob): Promise<void> {
  switch (job.type) {
    case "refresh_repository_metadata":
    case "take_repository_snapshot": {
      const payload = repositoryPayload.parse(job.payload);
      const result = await new IndexRepositoryService().execute(payload.fullName);
      await enqueueJob({
        type: "inspect_git_history",
        deduplicationKey: `inspect_git_history:${result.fullName.toLowerCase()}`,
        payload: { repositoryId: result.repositoryId, fullName: result.fullName },
        priority: Math.max(0, job.priority - 10),
        maxAttempts: 2,
      });
      return;
    }
    case "inspect_git_history": {
      const payload = repositoryPayload.parse(job.payload);
      const result = await new GitInspector().inspect(payload.fullName);
      await recalculateRepository(result.repositoryId);
      await classifyRepositoryTopics(result.repositoryId);
      return;
    }
    case "recalculate_repository_score": {
      const payload = repositoryPayload.pick({ repositoryId: true }).parse(job.payload);
      await recalculateRepository(payload.repositoryId);
      return;
    }
    case "refresh_rankings":
      await refreshRepositoryRankings();
      return;
    case "schedule_repository_refreshes":
      await scheduleRepositoryRefreshes();
      return;
    case "maintain_snapshots":
      await maintainSnapshots({ apply: true });
      return;
    case "refresh_developer": {
      const payload = developerPayload.parse(job.payload);
      await new IndexDeveloperService().execute(payload.username);
      return;
    }
    default:
      throw new WorkerJobError(`Unsupported job type ${job.type}`, "UNSUPPORTED_JOB", false);
  }
}

export class WorkerJobError extends Error {
  override name = "WorkerJobError";
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export function normalizeJobError(error: unknown): {
  code: string;
  message: string;
  retryable: boolean;
} {
  if (error instanceof PublicDocumentFetchError || error instanceof WorkerJobError)
    return { code: error.code, message: error.message, retryable: error.retryable };
  if (error instanceof z.ZodError)
    return { code: "INVALID_JOB_PAYLOAD", message: error.message, retryable: false };
  return {
    code: "JOB_EXECUTION_ERROR",
    message: error instanceof Error ? error.message : "Unknown job execution failure",
    retryable: true,
  };
}
