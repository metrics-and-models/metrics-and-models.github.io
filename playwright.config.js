import { defineConfig } from "@playwright/test";

const external = process.env.BROWSER_BASE_URL;
const prefix = (process.env.PATH_PREFIX || "").replace(/\/$/, "");
export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.mjs",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: external || "http://localhost:8081" + prefix + "/",
    browserName: "chromium",
    launchOptions: process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {},
    trace: "retain-on-failure",
  },
  projects: [
    { name: "wide-desktop", use: { viewport: { width: 1920, height: 1080 } } },
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 } } },
    { name: "small-mobile", use: { viewport: { width: 320, height: 740 } } },
  ],
  webServer: external
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:8081" + prefix + "/",
        reuseExistingServer: !process.env.CI,
        timeout: 30000,
      },
});
