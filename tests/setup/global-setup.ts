import { spawn, type ChildProcess } from "node:child_process";
import type { TestProject } from "vitest/node";
import { resetTestDatabase } from "../../scripts/db-migrate-test";

let postgrest: ChildProcess | undefined;

async function waitFor(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // pas encore prêt
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`PostgREST ne répond pas sur ${url}`);
}

export async function setup(project: TestProject): Promise<void> {
  const dbUrl = process.env.TEST_DATABASE_URL;
  if (!dbUrl) {
    console.warn("\n⚠ TEST_DATABASE_URL absent : les tests base de données et API sont IGNORÉS.\n");
    return;
  }
  await resetTestDatabase(dbUrl);

  const bin = process.env.POSTGREST_BIN;
  if (!bin) {
    console.warn("\n⚠ POSTGREST_BIN absent : les tests via l'API sont IGNORÉS.\n");
    return;
  }
  const port = process.env.POSTGREST_PORT ?? "54330";
  const dbUri = new URL(dbUrl);
  dbUri.username = "authenticator";
  dbUri.password = "authenticator";

  postgrest = spawn(bin, [], {
    env: {
      ...process.env,
      PGRST_DB_URI: dbUri.toString(),
      PGRST_DB_SCHEMAS: "public",
      PGRST_DB_ANON_ROLE: "anon",
      PGRST_JWT_SECRET: process.env.TEST_JWT_SECRET,
      PGRST_SERVER_PORT: port,
      PGRST_LOG_LEVEL: "error",
    },
    stdio: ["ignore", "ignore", "inherit"],
  });
  const url = `http://127.0.0.1:${port}`;
  await waitFor(url, 15_000);
  project.provide("postgrestUrl", url);
}

export async function teardown(): Promise<void> {
  postgrest?.kill();
}

declare module "vitest" {
  export interface ProvidedContext {
    postgrestUrl?: string;
  }
}
