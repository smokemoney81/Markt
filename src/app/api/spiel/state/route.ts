import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { refreshState } from "@/lib/game/server";

export const dynamic = "force-dynamic";

/** GET /api/spiel/state – aktuellen Spielstand laden (mit Regen + Offline-Angriffen). */
export async function GET(): Promise<NextResponse> {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Spiel-Server ist nicht konfiguriert.", code: "NICHT_KONFIGURIERT" },
      { status: 503 },
    );
  }

  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet.", code: "NICHT_ANGEMELDET" }, { status: 401 });
  }

  try {
    const service = createServiceClient();
    const { state, news } = await refreshState(service, user.id);
    return NextResponse.json({ state, news });
  } catch (err) {
    console.error("Spiel-Fehler (state):", err);
    return NextResponse.json({ error: "Interner Fehler.", code: "INTERN" }, { status: 500 });
  }
}
