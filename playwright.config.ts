import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: "performance.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: "http://127.0.0.1:3210",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npx -y pnpm@11.22.0 dev --port 3210",
    url: "http://127.0.0.1:3210",
    env: { FORGERANK_DATA_DIR: "data/e2e-pglite" },
    reuseExistingServer: false,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
