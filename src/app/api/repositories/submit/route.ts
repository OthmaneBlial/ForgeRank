import { NextResponse } from "next/server";
import { z } from "zod";

import { discoverRepository, enqueueRepositoryIndex } from "@/infrastructure/db/repository-store";
import {
  parseGitHubRepositoryInput,
  UnsupportedRepositoryUrlError,
} from "@/infrastructure/github-public/url";
import { clientHashForRequest, consumePersistentRateLimit } from "@/infrastructure/http/rate-limit";

export async function POST(request: Request) {
  const rate = await consumePersistentRateLimit({
    action: "repository_submission",
    clientHash: clientHashForRequest(request),
    limit: 5,
    windowMs: 60_000,
  });
  if (!rate.allowed)
    return NextResponse.json(
      { message: "Too many submissions. Try again in a minute." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds), "X-RateLimit-Remaining": "0" },
      },
    );
  try {
    const body = z.object({ repository: z.string().min(3).max(300) }).parse(await request.json());
    const identity = parseGitHubRepositoryInput(body.repository);
    const repository = await discoverRepository(identity);
    const queued = await enqueueRepositoryIndex(repository.id, identity.fullName, 75);
    return NextResponse.json(
      {
        message: queued
          ? `${identity.fullName} was added to the indexing queue.`
          : `${identity.fullName} is already queued or being indexed.`,
      },
      { status: queued ? 202 : 200, headers: { "X-RateLimit-Remaining": String(rate.remaining) } },
    );
  } catch (error) {
    if (error instanceof UnsupportedRepositoryUrlError || error instanceof z.ZodError)
      return NextResponse.json(
        { message: error instanceof Error ? error.message : "Invalid repository input." },
        { status: 400 },
      );
    return NextResponse.json(
      { message: "The indexing request could not be recorded." },
      { status: 503 },
    );
  }
}
