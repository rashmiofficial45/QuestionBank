import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 80_000,
  use: {
    baseURL: process.env.PREVIEW_URL ?? "http://127.0.0.1:3000",
    channel: process.env.CHROME_CHANNEL ?? "chromium",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
  },
});
