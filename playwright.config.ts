import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";
config({ path: ".env.local" });

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 1,
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    // Auth setup runs once and saves session to file
    { name: "setup", testMatch: /global\.setup\.ts/ },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/session.json",
      },
      dependencies: ["setup"],
    },
  ],
  // No webServer — run `npm run dev` separately before running e2e tests
});
