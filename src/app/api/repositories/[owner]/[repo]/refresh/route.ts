import { NextResponse } from "next/server";

import { requestRepositoryRefresh } from "@/application/request-repository-refresh";
import { clientHashForRequest, consumePersistentRateLimit } from "@/infrastructure/http/rate-limit";

type RouteParams = Promise<{ owner: string; repo: string }>;

export async function POST(request: Request, { params }: { params: RouteParams }) {
  const rate = await consumePersistentRateLimit({
    action: "repository_refresh",
    clientHash: clientHashForRequest(request),
    limit: 10,
    windowMs: 60 * 60 * 1_000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { message: "Too many refresh requests. Cached data remains available." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds), "X-RateLimit-Remaining": "0" },
      },
    );
  }
  const { owner, repo } = await params;
  const result = await requestRepositoryRefresh(owner, repo);
  if (result.status === "NOT_FOUND")
    return NextResponse.json(
      { message: "This repository is not in the ForgeRank index." },
      { status: 404 },
    );
  if (result.status === "COOLDOWN") {
    return NextResponse.json({
      message:
        "A recent refresh request is already recorded. ForgeRank will serve cached data until the queue and source policy permit another observation.",
    });
  }
  return NextResponse.json(
    {
      message:
        result.status === "QUEUED"
          ? "Refresh requested. The policy-governed worker will process it when capacity permits."
          : "A refresh is already queued; its priority was retained or increased.",
    },
    {
      status: result.status === "QUEUED" ? 202 : 200,
      headers: { "X-RateLimit-Remaining": String(rate.remaining) },
    },
  );
}
