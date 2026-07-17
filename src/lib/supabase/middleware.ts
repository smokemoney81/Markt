import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function updateSession(request: NextRequest) {
  // Ohne Konfiguration einfach durchlassen (z. B. lokal vor dem Setup).
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.next({ request });
  }

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login");
  const isPublicRoute = isAuthRoute || pathname.startsWith("/play");
  const isApiRoute = pathname.startsWith("/api");

  // Geschützte Route (nicht Public/API) -> immer zum Login
  // Keine automatische Session-Wiederherstellung
  if (!isPublicRoute && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}

/**
 * Erzeugt einen Redirect und überträgt die von Supabase aufgefrischten
 * Auth-Cookies aus `supabaseResponse` auf die Redirect-Antwort. Ohne dieses
 * Kopieren gehen die (rotierten) Session-Cookies beim Redirect verloren →
 * Redirect-Loops / vorzeitiger Logout (Supabase-SSR-Muster).
 */
function redirectWithSession(url: URL, supabaseResponse: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirect.cookies.set(cookie);
  });
  return redirect;
}
