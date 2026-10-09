import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 10 * 60 * 1000,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL: "http://localhost:8787", headless: true },
  webServer: {
    command: "npx wrangler dev --port 8787",
    url: "http://localhost:8787/",
    reuseExistingServer: !process.env["CI"],
    timeout: 120_000,
  },
});
