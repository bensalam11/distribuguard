import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { publicEnv } from "@/lib/env";
import { HOME_PATH, LOGIN_PATH, isPublicPath } from "@/lib/routes";

/** Rafraîchit la session Supabase et protège les pages de l'application. */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = publicEnv();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
      },
    },
  });

  // getClaims vérifie le jeton localement (clés ES256 publiées par Supabase) et le
  // rafraîchit si besoin : pas d'aller-retour réseau vers Auth à chaque clic.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ? data.claims : null;

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const target = request.nextUrl.clone();
    target.pathname = LOGIN_PATH;
    target.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(target);
  }

  if (user && (pathname === LOGIN_PATH || pathname === "/inscription" || pathname === "/")) {
    const target = request.nextUrl.clone();
    target.pathname = HOME_PATH;
    target.search = "";
    return NextResponse.redirect(target);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
