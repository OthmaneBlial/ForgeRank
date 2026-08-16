export type WorkerHeartbeatState = "healthy" | "missing" | "stale" | "stopping";

export interface WorkerHeartbeatAssessment {
  state: WorkerHeartbeatState;
  ageSeconds: number | null;
}

export function assessWorkerHeartbeat(
  heartbeat: { updatedAt: Date; reportedStatus: string } | null,
  now = new Date(),
  maximumAgeSeconds = 90,
): WorkerHeartbeatAssessment {
  if (!heartbeat) return { state: "missing", ageSeconds: null };
  const ageSeconds = Math.max(
    0,
    Math.floor((now.getTime() - heartbeat.updatedAt.getTime()) / 1_000),
  );
  if (heartbeat.reportedStatus !== "RUNNING") return { state: "stopping", ageSeconds };
  return { state: ageSeconds <= maximumAgeSeconds ? "healthy" : "stale", ageSeconds };
}
