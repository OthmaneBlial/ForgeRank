import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "performance.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  preserveOutput: "always",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3211",
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx -y pnpm@11.22.0 serve:production-audit",
    url: "http://127.0.0.1:3211",
    env: { FORGERANK_DATA_DIR: "data/e2e-pglite" },
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop-production", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-production", use: { ...devices["Pixel 7"] } },
  ],
});
