import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "test/e2e",
  timeout: 60000,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3106",
    // Assertions use the pt-BR catalog; this also sends Accept-Language: pt-BR.
    locale: "pt-BR",
    trace: "retain-on-failure",
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
  },
  webServer: {
    command: "node test/start-production.mjs",
    url: "http://127.0.0.1:3106",
    reuseExistingServer: false,
    timeout: 60000,
  },
});
