import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/infrastructure/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://forgerank:forgerank@localhost:5432/forgerank",
  },
  strict: true,
  verbose: true,
});
