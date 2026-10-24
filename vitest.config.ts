import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

// Variables locales des tests (base PostgreSQL, binaire PostgREST) : .env.test.local
loadEnv({ path: ".env.test.local", quiet: true });
// Secret propre aux tests locaux : jamais utilisé hors de la base de test.
process.env.TEST_JWT_SECRET ??= "test-only-jwt-secret-at-least-32-characters-long";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    globalSetup: ["tests/setup/global-setup.ts"],
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
