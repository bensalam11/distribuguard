import { defineConfig, devices } from "@playwright/test";

/**
 * Parcours critiques dans un vrai navigateur. L'application doit tourner
 * (npm run build && npm start) et pointer vers un Supabase de test.
 * Voir la section « Tests » du README.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "fr-FR",
    timezoneId: "Africa/Douala",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
