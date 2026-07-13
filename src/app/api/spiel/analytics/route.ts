/**
 * GET /api/spiel/analytics
 *
 * Liefert Player-Statistiken für die Analytics-Seite.
 * Autorisiert nur den eingeloggten Nutzer für die eigenen Stats.
 */

import { getPlayerStats } from "@/lib/game/analytics";
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Token verifizieren
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const stats = await getPlayerStats(supabase, data.user.id);
    if (!stats) {
      return NextResponse.json({ error: "No game state found" }, { status: 404 });
    }

    return NextResponse.json(stats);
  } catch (err) {
    console.error("Analytics error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
