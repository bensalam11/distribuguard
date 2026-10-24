/** Pages accessibles sans être connecté. */
export const PUBLIC_PATHS = ["/connexion", "/inscription", "/mot-de-passe-oublie", "/auth"] as const;

export const HOME_PATH = "/tableau-de-bord";
export const LOGIN_PATH = "/connexion";

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** N'accepte qu'un chemin interne, pour éviter les redirections ouvertes. */
export function safeNextPath(next: string | null | undefined, fallback: string = HOME_PATH): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }
  return next;
}
