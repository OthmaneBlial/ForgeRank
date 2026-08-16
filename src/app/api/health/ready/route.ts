import { sql } from "drizzle-orm";

import { getDatabase } from "@/infrastructure/db/client";

const headers = {
  "Cache-Control": "no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const database = await getDatabase();
    await Promise.race([
      database.execute(sql`select 1 as ready`),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Readiness query timed out.")), 3_000);
      }),
    ]);
    return Response.json({ status: "ready", database: "reachable" }, { headers });
  } catch {
    return Response.json(
      { status: "unavailable", database: "unreachable" },
      { status: 503, headers },
    );
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
