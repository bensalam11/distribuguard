import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_PATH } from "@/lib/routes";
import { signOut } from "@/lib/server/auth";

/** Déconnexion (POST uniquement, pour éviter une déconnexion par simple lien). */
export async function POST(request: NextRequest) {
  await signOut();
  const target = request.nextUrl.clone();
  target.pathname = LOGIN_PATH;
  target.search = "";
  return NextResponse.redirect(target, { status: 303 });
}
