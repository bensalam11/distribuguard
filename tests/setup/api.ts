/** Client PostgREST avec un vrai JWT signé (comme supabase-js côté navigateur). */
import { createHmac } from "node:crypto";
import { PostgrestClient } from "@supabase/postgrest-js";
import { inject } from "vitest";

export const postgrestUrl = inject("postgrestUrl");
const secret = process.env.TEST_JWT_SECRET ?? "";

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

export function signJwt(payload: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 600 }));
  const signature = createHmac("sha256", secret).update(`${header}.${body}`).digest("base64url");
  return `${header}.${body}.${signature}`;
}

export function clientFor(userId: string | null) {
  const token = signJwt(userId ? { sub: userId, role: "authenticated" } : { role: "anon" });
  return new PostgrestClient(postgrestUrl!, { headers: { Authorization: `Bearer ${token}` } });
}
