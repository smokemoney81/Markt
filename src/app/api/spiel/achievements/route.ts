/**
 * GET /api/spiel/achievements
 *
 * Liefert Player-Achievements mit Unlock-Status.
 * Autorisiert nur den eingeloggten Nutzer für die eigenen Achievements.
 */

import { getPlayerAchievements } from "@/lib/game/analytics";
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

    const achievements = await getPlayerAchievements(supabase, data.user.id);
    return NextResponse.json(achievements);
  } catch (err) {
    console.error("Achievements error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
