import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { GameError, runAction, type ActionResponse, type GameAction } from "@/lib/game/server";

/**
 * Authentifiziert den Nutzer über die Session und liefert einen Service-Role-
 * Client. Gibt entweder `{ error }` (fertige Antwort) oder `{ userId, service }`
 * zurück. Basis für alle Spiel-Routen, die selbst Logik ausführen (Shop etc.).
 */
export async function authAndService(): Promise<
  { error: NextResponse } | { userId: string; service: SupabaseClient }
> {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      error: NextResponse.json(
        { error: "Spiel-Server ist nicht konfiguriert.", code: "NICHT_KONFIGURIERT" },
        { status: 503 },
      ),
    };
  }
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Nicht angemeldet.", code: "NICHT_ANGEMELDET" }, { status: 401 }) };
  }
  return { userId: user.id, service: createServiceClient() };
}

/** Übersetzt einen Fehler aus der Spiel-Logik in eine JSON-Antwort. */
export function gameErrorResponse(err: unknown): NextResponse {
  if (err instanceof GameError) {
    const status = err.code === "ZAHLUNG_NICHT_KONFIGURIERT" ? 402 : 400;
    return NextResponse.json({ error: err.message, code: err.code }, { status });
  }
  console.error("Spiel-Fehler:", err);
  return NextResponse.json({ error: "Interner Fehler.", code: "INTERN" }, { status: 500 });
}

/**
 * Gemeinsame Logik aller Spiel-Routen: authentifiziert den Nutzer über die
 * Session (Cookie) und führt die Aktion autoritativ mit dem Service-Role-
 * Client aus. So bleibt die einzige Schreibstelle serverseitig.
 */
export async function handleGameAction(action: GameAction): Promise<NextResponse> {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Spiel-Server ist nicht konfiguriert.", code: "NICHT_KONFIGURIERT" },
      { status: 503 },
    );
  }

  // Nutzer aus der Session bestimmen (nicht aus dem Request-Body → nicht fälschbar).
  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet.", code: "NICHT_ANGEMELDET" }, { status: 401 });
  }

  try {
    const service = createServiceClient();
    const result: ActionResponse = await runAction(service, user.id, action);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof GameError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    console.error("Spiel-Fehler:", err);
    return NextResponse.json({ error: "Interner Fehler.", code: "INTERN" }, { status: 500 });
  }
}
