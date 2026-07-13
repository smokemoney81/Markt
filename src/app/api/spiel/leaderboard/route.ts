import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Nicht konfiguriert.", code: "NICHT_KONFIGURIERT" }, { status: 503 });
  }

  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet.", code: "NICHT_ANGEMELDET" }, { status: 401 });
  }

  try {
    const service = createServiceClient();
    const url = new URL(req.url);
    const period = url.searchParams.get("period") ?? "global";
    const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "10", 10));

    const { data: leaderboard } = await service
      .from("leaderboards")
      .select("rank, user_id, score, coins_earned")
      .eq("period", period)
      .order("rank", { ascending: true })
      .limit(limit);

    const { data: myRank } = await service
      .from("leaderboards")
      .select("rank, score")
      .eq("user_id", user.id)
      .eq("period", period)
      .single();

    return NextResponse.json({
      leaderboard: leaderboard ?? [],
      myRank: myRank ?? { rank: null, score: 0 },
    });
  } catch (err) {
    console.error("Leaderboard-Fehler:", err);
    return NextResponse.json({ error: "Fehler beim Laden.", code: "INTERN" }, { status: 500 });
  }
}
