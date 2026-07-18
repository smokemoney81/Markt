import { NextResponse, type NextRequest } from "next/server";

/**
 * Bewusst KEINE serverseitige Session-Wiederherstellung mehr.
 *
 * Früher las die Middleware die Supabase-Session aus den Cookies (`getUser()`)
 * und leitete anhand davon um. Das wirkte wie ein „automatischer Login": Wer
 * ein gültiges Cookie hatte, landete direkt im Dashboard, ohne die Login-Seite
 * zu sehen. Gewünscht ist stattdessen, dass die Middleware die Session NICHT
 * lädt und Anfragen einfach durchreicht.
 *
 * Der Zugriffsschutz („nicht eingeloggt -> auf die Login-Seite") passiert
 * jetzt client-seitig im `AuthGuard` (siehe `src/components/AuthGuard.tsx`),
 * der im App-Layout die geschützten Seiten umschließt.
 */
export async function updateSession(request: NextRequest) {
  return NextResponse.next({ request });
}
