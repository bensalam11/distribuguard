/**
 * Outils de test base de données : exécuter des requêtes « en tant que »
 * un utilisateur authentifié (comme le fait PostgREST/Supabase), et simuler
 * la création de comptes par Supabase Auth.
 */
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { afterAll } from "vitest";

export const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

let pool: Pool | undefined;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 10 });
    afterAll(async () => {
      await pool?.end();
      pool = undefined;
    });
  }
  return pool;
}

/** Requête en super-utilisateur (contourne RLS) : préparation et vérifications. */
export async function adminQuery<T extends QueryResultRow = QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await getPool().query<T>(sql, params);
  return res.rows;
}

export type Session = {
  query<T extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<T[]>;
};

async function withRole<R>(
  role: "anon" | "authenticated",
  userId: string | null,
  fn: (client: PoolClient) => Promise<R>,
): Promise<R> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    await client.query(`set local role ${role}`);
    const claims = JSON.stringify(userId ? { sub: userId, role } : { role });
    await client.query("select set_config('request.jwt.claims', $1, true)", [claims]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

/** Chaque requête s'exécute dans sa propre transaction, avec le rôle et le JWT donnés. */
export function as(userId: string | null): Session {
  return {
    query: (sql, params = []) =>
      withRole(userId ? "authenticated" : "anon", userId, async (c) => (await c.query(sql, params)).rows),
  };
}

export const anon = (): Session => as(null);

export function uniqueEmail(prefix = "user"): string {
  return `${prefix}-${randomUUID().slice(0, 8)}@test.local`;
}

export type SignupMeta = {
  full_name: string;
  company_name: string;
  phone: string;
  city: string;
  address: string;
};

/** Simule `supabase.auth.signUp` : insertion dans auth.users (déclenche le trigger). */
export async function createAuthUser(email: string, meta: Record<string, unknown>): Promise<string> {
  const rows = await adminQuery<{ id: string }>(
    "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
    [email, JSON.stringify(meta)],
  );
  return rows[0].id;
}

export async function signupOrganization(overrides: Partial<SignupMeta> = {}) {
  const email = uniqueEmail("owner");
  const meta: SignupMeta = {
    full_name: "Jean Mbarga",
    company_name: `Distrib ${randomUUID().slice(0, 6)}`,
    phone: "+237 690 00 00 00",
    city: "Douala",
    address: "Akwa, rue Joss",
    ...overrides,
  };
  const userId = await createAuthUser(email, { signup_kind: "organization", ...meta });
  const [{ organization_id }] = await adminQuery<{ organization_id: string }>(
    "select organization_id from public.members where user_id = $1",
    [userId],
  );
  return { userId, email, orgId: organization_id, meta };
}

/** Le propriétaire invite, puis Supabase Auth crée le compte invité. */
export async function inviteMember(
  ownerId: string,
  role: "manager" | "storekeeper" | "cashier",
  email = uniqueEmail(role),
) {
  const [{ create_invitation: invitationId }] = await as(ownerId).query<{ create_invitation: string }>(
    "select public.create_invitation($1, $2, $3::public.member_role)",
    [email, `Employé ${role}`, role],
  );
  const userId = await createAuthUser(email, { invitation_id: invitationId });
  return { userId, email, invitationId };
}
