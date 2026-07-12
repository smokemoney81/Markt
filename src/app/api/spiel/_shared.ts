import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { GameError, runAction, type ActionResponse, type GameAction } from "@/lib/game/server";

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
