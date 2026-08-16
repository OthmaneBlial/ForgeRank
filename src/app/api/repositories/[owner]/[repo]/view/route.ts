import { NextResponse } from "next/server";

import { recordRepositoryPageView } from "@/infrastructure/db/repository-store";
import { clientHashForRequest, consumePersistentRateLimit } from "@/infrastructure/http/rate-limit";

type RouteParams = Promise<{ owner: string; repo: string }>;

export async function POST(request: Request, { params }: { params: RouteParams }) {
  const clientHash = clientHashForRequest(request);
  const globalRate = await consumePersistentRateLimit({
    action: "repository_view",
    clientHash,
    limit: 100,
    windowMs: 60 * 60 * 1_000,
  });
  if (!globalRate.allowed) return new NextResponse(null, { status: 204 });
  const { owner, repo } = await params;
  const repositoryRate = await consumePersistentRateLimit({
    action: `repository_view:${owner.toLowerCase()}/${repo.toLowerCase()}`,
    clientHash,
    limit: 1,
    windowMs: 6 * 60 * 60 * 1_000,
  });
  if (repositoryRate.allowed) await recordRepositoryPageView(owner, repo);
  return new NextResponse(null, { status: 204 });
}
