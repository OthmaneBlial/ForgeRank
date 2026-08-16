import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";

import { getDatabase, getDatabaseDriver } from "./client";

export async function inspectDatabaseSize(): Promise<number | null> {
  const database = await getDatabase();
  if (getDatabaseDriver() === "postgres") {
    const [row] = await database
      .select({ bytes: sql<number>`pg_database_size(current_database())::float8` })
      .from(sql`(select 1) as database_size_probe`);
    return row?.bytes === undefined ? null : Number(row.bytes);
  }
  const dataDirectory =
    process.env.FORGERANK_DATA_DIR ?? path.join(process.cwd(), "data", "pglite");
  return directoryBytes(dataDirectory);
}

async function directoryBytes(directory: string): Promise<number> {
  let total = 0;
  try {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      const metadata = await lstat(target);
      total += entry.isDirectory() ? await directoryBytes(target) : metadata.size;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
  return total;
}
