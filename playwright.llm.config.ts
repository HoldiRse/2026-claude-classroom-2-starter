import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// Same dev server, browser and port as the default suite — only the directory
// and the timeouts differ, because every run here spends real OpenRouter calls.
// Deliberately not part of `npm run test:e2e`; run it with `npm run test:e2e:llm`.
export default defineConfig({
  ...base,
  testDir: "./tests/e2e-llm",
  timeout: 120_000,
  expect: { timeout: 30_000 },
});
