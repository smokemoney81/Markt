import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Ohne Konfiguration einfach durchlassen (z. B. lokal vor dem Setup).
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/login");
  // Öffentlich zugänglich (kein Login nötig), z. B. die frei spielbaren Spiele.
  const isPublicRoute = isAuthRoute || pathname.startsWith("/play");
  // API-Routen kümmern sich selbst um Auth (JSON-Antworten statt Redirect);
  // insbesondere der Stripe-Webhook hat keine Session-Cookies.
  const isApiRoute = pathname.startsWith("/api");

  // Nicht eingeloggt + geschützte Route -> zum Login
  if (!user && !isPublicRoute && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return redirectWithSession(url, supabaseResponse);
  }

  // Eingeloggt + Login-Seite -> zum Dashboard
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return redirectWithSession(url, supabaseResponse);
  }

  return supabaseResponse;
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
