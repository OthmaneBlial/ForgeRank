import path from "node:path";

import { getDatabase, getDatabaseDriver } from "./client";

export async function migrateDatabase(): Promise<void> {
  const database = await getDatabase();
  const migrationsFolder = path.join(process.cwd(), "drizzle");

  if (getDatabaseDriver() === "postgres") {
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    await migrate(database as never, { migrationsFolder });
    return;
  }

  const { migrate } = await import("drizzle-orm/pglite/migrator");
  await migrate(database, { migrationsFolder });
}
