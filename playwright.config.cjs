const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  testMatch: ["new-effects.spec.cjs", "studio.spec.cjs"],
  timeout: 90000,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:8873",
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
    launchOptions: {
      args: process.platform === "darwin" ? ["--use-angle=metal"] : [],
    },
  },
  webServer: {
    command: "python3 -m http.server 8873 --bind 127.0.0.1",
    url: "http://127.0.0.1:8873",
    reuseExistingServer: false,
    timeout: 10000,
  },
});
