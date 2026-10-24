/**
 * (Re)crée la base de test locale et y applique l'imitation Supabase puis
 * toutes les migrations, dans l'ordre. Utilisé par les tests (global setup)
 * et lançable à la main : `npm run db:test:reset`.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

const ROOT = path.resolve(__dirname, "..");

export async function resetTestDatabase(databaseUrl: string): Promise<void> {
  const url = new URL(databaseUrl);
  const dbName = url.pathname.replace(/^\//, "");
  if (!/_test$/.test(dbName)) {
    throw new Error(`Refus : la base de test doit se terminer par "_test" (reçu "${dbName}").`);
  }

  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  try {
    await admin.query(`drop database if exists "${dbName}" with (force)`);
    await admin.query(`create database "${dbName}"`);
  } finally {
    await admin.end();
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(readFileSync(path.join(ROOT, "supabase/tests/supabase_stub.sql"), "utf8"));
    const dir = path.join(ROOT, "supabase/migrations");
    for (const file of readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      const sql = readFileSync(path.join(dir, file), "utf8");
      try {
        await client.query("begin");
        await client.query(sql);
        await client.query("commit");
      } catch (error) {
        await client.query("rollback");
        throw new Error(`Migration ${file} : ${(error as Error).message}`);
      }
    }
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    console.error("TEST_DATABASE_URL manquant (voir .env.example).");
    process.exit(1);
  }
  resetTestDatabase(url)
    .then(() => console.log("Base de test prête."))
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
