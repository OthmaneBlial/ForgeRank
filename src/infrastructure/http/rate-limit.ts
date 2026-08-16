import { createHmac } from "node:crypto";

import { eq, lt } from "drizzle-orm";

import { getDatabase } from "@/infrastructure/db/client";
import { rateLimitWindows } from "@/infrastructure/db/schema";

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfterSeconds: number };

export function clientHashForRequest(request: Request): string {
  const trustProxy = process.env.FORGERANK_TRUST_PROXY === "1";
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = trustProxy
    ? forwarded || request.headers.get("x-real-ip") || "proxy-unknown"
    : "direct-client";
  const userAgent = request.headers.get("user-agent")?.slice(0, 200) ?? "unknown-agent";
  const salt = process.env.FORGERANK_RATE_LIMIT_SALT ?? "forgerank-local-rate-limit-v1";
  return createHmac("sha256", salt).update(`${address}\n${userAgent}`).digest("hex").slice(0, 32);
}

export async function consumePersistentRateLimit(input: {
  action: string;
  clientHash: string;
  limit: number;
  windowMs: number;
  now?: Date;
}): Promise<RateLimitResult> {
  const database = await getDatabase();
  const now = input.now ?? new Date();
  const key = createHmac("sha256", "forgerank-rate-window-v1")
    .update(`${input.action}:${input.clientHash}`)
    .digest("hex");
  return database.transaction(async (transaction) => {
    await transaction
      .delete(rateLimitWindows)
      .where(lt(rateLimitWindows.updatedAt, new Date(now.getTime() - 7 * 24 * 60 * 60 * 1_000)));
    await transaction
      .insert(rateLimitWindows)
      .values({
        key,
        action: input.action,
        clientHash: input.clientHash,
        windowStartedAt: now,
        requestCount: 0,
        updatedAt: now,
      })
      .onConflictDoNothing();
    const [window] = await transaction
      .select()
      .from(rateLimitWindows)
      .where(eq(rateLimitWindows.key, key))
      .for("update");
    if (!window) throw new Error("The persistent rate-limit window could not be initialized.");
    const elapsed = now.getTime() - window.windowStartedAt.getTime();
    if (elapsed >= input.windowMs) {
      await transaction
        .update(rateLimitWindows)
        .set({ windowStartedAt: now, requestCount: 1, updatedAt: now })
        .where(eq(rateLimitWindows.key, key));
      return { allowed: true, remaining: Math.max(0, input.limit - 1), retryAfterSeconds: 0 };
    }
    if (window.requestCount >= input.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((input.windowMs - elapsed) / 1_000));
      await transaction
        .update(rateLimitWindows)
        .set({ updatedAt: now })
        .where(eq(rateLimitWindows.key, key));
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }
    const requestCount = window.requestCount + 1;
    await transaction
      .update(rateLimitWindows)
      .set({ requestCount, updatedAt: now })
      .where(eq(rateLimitWindows.key, key));
    return {
      allowed: true,
      remaining: Math.max(0, input.limit - requestCount),
      retryAfterSeconds: 0,
    };
  });
}
