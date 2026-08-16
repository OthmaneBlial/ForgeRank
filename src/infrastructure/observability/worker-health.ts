import { and, desc, eq, like, lt } from "drizzle-orm";

import { assessWorkerHeartbeat } from "@/domain/system-health";
import { getDatabase } from "@/infrastructure/db/client";
import { systemState } from "@/infrastructure/db/schema";

const HEARTBEAT_PREFIX = "worker_heartbeat:";

export async function recordWorkerHeartbeat(input: {
  workerId: string;
  status: "RUNNING" | "STOPPING";
  activeJobId?: string;
}): Promise<void> {
  const database = await getDatabase();
  const key = `${HEARTBEAT_PREFIX}${input.workerId}`;
  const value = {
    workerId: input.workerId,
    status: input.status,
    activeJobId: input.activeJobId ?? null,
  };
  await database
    .insert(systemState)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: systemState.key, set: { value, updatedAt: new Date() } });
}

export async function pruneWorkerHeartbeats(now = new Date()): Promise<void> {
  const database = await getDatabase();
  await database
    .delete(systemState)
    .where(
      and(
        like(systemState.key, `${HEARTBEAT_PREFIX}%`),
        lt(systemState.updatedAt, new Date(now.getTime() - 7 * 24 * 60 * 60 * 1_000)),
      ),
    );
}

export async function getLatestWorkerHealth(maximumAgeSeconds = 90) {
  const database = await getDatabase();
  const [heartbeat] = await database
    .select()
    .from(systemState)
    .where(like(systemState.key, `${HEARTBEAT_PREFIX}%`))
    .orderBy(desc(systemState.updatedAt))
    .limit(1);
  if (!heartbeat)
    return { workerId: null, ...assessWorkerHeartbeat(null, new Date(), maximumAgeSeconds) };
  const workerId =
    typeof heartbeat.value.workerId === "string" ? heartbeat.value.workerId : heartbeat.key;
  const reportedStatus =
    typeof heartbeat.value.status === "string" ? heartbeat.value.status : "UNKNOWN";
  return {
    workerId,
    ...assessWorkerHeartbeat(
      { updatedAt: heartbeat.updatedAt, reportedStatus },
      new Date(),
      maximumAgeSeconds,
    ),
  };
}

export async function removeWorkerHeartbeat(workerId: string): Promise<void> {
  const database = await getDatabase();
  await database.delete(systemState).where(eq(systemState.key, `${HEARTBEAT_PREFIX}${workerId}`));
}
