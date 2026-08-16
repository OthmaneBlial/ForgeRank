import { setTimeout as delay } from "node:timers/promises";

import { eq, gte, lt, sql } from "drizzle-orm";

import { getDatabase } from "@/infrastructure/db/client";
import { crawlHostStates, crawlRequestEvents } from "@/infrastructure/db/schema";

export class CircuitOpenError extends Error {
  override name = "CircuitOpenError";
}

export class ConservativeRequestPolicy {
  constructor(
    private readonly minimumIntervalMs = Number(process.env.MIN_REQUEST_INTERVAL_MS ?? 5_000),
    private readonly hourlyBudget = Number(process.env.HOURLY_CRAWL_BUDGET ?? 60),
    private readonly dailyBudget = Number(process.env.DAILY_CRAWL_BUDGET ?? 500),
  ) {}

  async beforeRequest(url: URL): Promise<void> {
    const database = await getDatabase();
    await database.transaction(async (transaction) => {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1_000);
      const hourAgo = new Date(now.getTime() - 60 * 60 * 1_000);
      await transaction
        .insert(crawlHostStates)
        .values({ host: "__global__" })
        .onConflictDoNothing();
      await transaction
        .select()
        .from(crawlHostStates)
        .where(eq(crawlHostStates.host, "__global__"))
        .for("update");
      await transaction
        .delete(crawlRequestEvents)
        .where(lt(crawlRequestEvents.requestedAt, dayAgo));
      const [[hourly], [daily]] = await Promise.all([
        transaction
          .select({ count: sql<number>`count(*)::int` })
          .from(crawlRequestEvents)
          .where(gte(crawlRequestEvents.requestedAt, hourAgo)),
        transaction.select({ count: sql<number>`count(*)::int` }).from(crawlRequestEvents),
      ]);
      if ((hourly?.count ?? 0) >= this.hourlyBudget || (daily?.count ?? 0) >= this.dailyBudget) {
        throw new CircuitOpenError(
          "The configured persistent crawl budget has been exhausted; cached data remains available.",
        );
      }

      await transaction.insert(crawlHostStates).values({ host: url.host }).onConflictDoNothing();
      const [hostState] = await transaction
        .select()
        .from(crawlHostStates)
        .where(eq(crawlHostStates.host, url.host))
        .for("update");
      if (hostState?.openedUntil && hostState.openedUntil > now) {
        throw new CircuitOpenError(
          `Requests to ${url.host} are paused until ${hostState.openedUntil.toISOString()}.`,
        );
      }

      const previous = hostState?.lastRequestAt?.getTime() ?? 0;
      const waitMs = Math.max(0, previous + this.minimumIntervalMs - Date.now());
      if (waitMs > 0) await delay(waitMs);
      const jitterMs = Math.floor(Math.random() * Math.min(400, this.minimumIntervalMs * 0.1));
      if (jitterMs > 0) await delay(jitterMs);
      const requestedAt = new Date();
      await transaction.insert(crawlRequestEvents).values({ host: url.host, requestedAt });
      await transaction
        .update(crawlHostStates)
        .set({ lastRequestAt: requestedAt, updatedAt: requestedAt })
        .where(eq(crawlHostStates.host, url.host));
    });
  }

  async recordSuccess(host: string): Promise<void> {
    const database = await getDatabase();
    await database
      .insert(crawlHostStates)
      .values({ host, consecutiveFailures: 0, openedUntil: null })
      .onConflictDoUpdate({
        target: crawlHostStates.host,
        set: { consecutiveFailures: 0, openedUntil: null, updatedAt: new Date() },
      });
  }

  async recordFailure(host: string): Promise<void> {
    const database = await getDatabase();
    await database.transaction(async (transaction) => {
      await transaction.insert(crawlHostStates).values({ host }).onConflictDoNothing();
      const [current] = await transaction
        .select()
        .from(crawlHostStates)
        .where(eq(crawlHostStates.host, host))
        .for("update");
      const consecutiveFailures = (current?.consecutiveFailures ?? 0) + 1;
      await transaction
        .update(crawlHostStates)
        .set({
          consecutiveFailures,
          openedUntil: consecutiveFailures >= 5 ? new Date(Date.now() + 15 * 60 * 1_000) : null,
          updatedAt: new Date(),
        })
        .where(eq(crawlHostStates.host, host));
    });
  }
}
