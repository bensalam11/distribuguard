/**
 * Lecture des e-mails envoyés par Supabase Auth pendant les tests :
 *  - E2E_MAILPIT_URL : Mailpit (fourni par `supabase start`, ex. http://127.0.0.1:54324) ;
 *  - E2E_MAIL_DIR    : dossier où un serveur SMTP de test dépose des fichiers .eml.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

export const hasMailbox = Boolean(process.env.E2E_MAILPIT_URL || process.env.E2E_MAIL_DIR);

function decodeQuotedPrintable(raw: string): string {
  return raw.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

function firstLink(html: string): string | null {
  const m = decodeQuotedPrintable(html).match(/href="([^"]+)"/);
  return m ? m[1].replace(/&amp;/g, "&") : null;
}

async function fromMailpit(base: string, to: string): Promise<string | null> {
  const res = await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}&limit=1`);
  const list = (await res.json()) as { messages?: Array<{ ID: string }> };
  const id = list.messages?.[0]?.ID;
  if (!id) return null;
  const msg = (await (await fetch(`${base}/api/v1/message/${id}`)).json()) as { HTML?: string };
  return msg.HTML ? firstLink(msg.HTML) : null;
}

function fromDir(dir: string, to: string, since: number): string | null {
  const files = readdirSync(dir)
    .map((f) => path.join(dir, f))
    .filter((f) => statSync(f).mtimeMs >= since)
    .sort()
    .reverse();
  for (const file of files) {
    const raw = readFileSync(file, "utf8");
    if (raw.toLowerCase().includes(to.toLowerCase())) return firstLink(raw);
  }
  return null;
}

/** Attend le dernier e-mail reçu par `to` (envoyé après `since`) et renvoie son premier lien. */
export async function waitForLink(to: string, since: number, timeoutMs = 15_000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const link = process.env.E2E_MAILPIT_URL
      ? await fromMailpit(process.env.E2E_MAILPIT_URL, to)
      : fromDir(process.env.E2E_MAIL_DIR!, to, since);
    if (link) return link;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Aucun e-mail reçu pour ${to}`);
}
