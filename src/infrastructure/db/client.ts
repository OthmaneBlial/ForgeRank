import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { drizzle as drizzlePglite, type PgliteDatabase } from "drizzle-orm/pglite";

import { schema } from "./schema";

export type ForgeDatabase = PgliteDatabase<typeof schema>;

type DatabaseState = {
  database?: Promise<ForgeDatabase>;
  close?: () => Promise<void>;
  driver: "pglite" | "postgres" | null;
};

const globalDatabase = globalThis as typeof globalThis & {
  __forgerankDatabase?: DatabaseState;
};

const state = (globalDatabase.__forgerankDatabase ??= { driver: null });

async function createDatabase(): Promise<ForgeDatabase> {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (databaseUrl) {
    const [{ default: postgres }, { drizzle }] = await Promise.all([
      import("postgres"),
      import("drizzle-orm/postgres-js"),
    ]);
    const client = postgres(databaseUrl, {
      max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
      idle_timeout: 20,
      connect_timeout: 15,
      prepare: false,
    });
    state.close = async () => {
      await client.end({ timeout: 5 });
    };
    state.driver = "postgres";
    return drizzle(client, { schema }) as unknown as ForgeDatabase;
  }

  const dataDirectory =
    process.env.FORGERANK_DATA_DIR ?? path.join(process.cwd(), "data", "pglite");
  const client = new PGlite(dataDirectory, { extensions: { pg_trgm } });
  state.close = async () => {
    await client.close();
  };
  state.driver = "pglite";
  return drizzlePglite(client, { schema });
}

export function getDatabase(): Promise<ForgeDatabase> {
  state.database ??= createDatabase();
  return state.database;
}

export function getDatabaseDriver(): DatabaseState["driver"] {
  return state.driver;
}

export async function closeDatabase(): Promise<void> {
  await state.close?.();
  state.database = undefined;
  state.close = undefined;
  state.driver = null;
}
