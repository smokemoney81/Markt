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
    const { data: friendIds } = await service
      .from("game_state")
      .select("friend_ids")
      .eq("user_id", user.id)
      .single();

    const friends = friendIds?.friend_ids ?? [];
    return NextResponse.json({ friends });
  } catch (err) {
    console.error("Freunde-Fehler:", err);
    return NextResponse.json({ error: "Fehler beim Laden.", code: "INTERN" }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Nicht konfiguriert.", code: "NICHT_KONFIGURIERT" }, { status: 503 });
  }

  const auth = await createClient();
  const { data: { user } } = await auth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet.", code: "NICHT_ANGEMELDET" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { action: "send-gift"; recipientId: string; coins: number; spins: number };
    const service = createServiceClient();

    if (body.action === "send-gift") {
      const { coins, spins } = body;
      await service.from("gifts").insert({
        sender_id: user.id,
        recipient_id: body.recipientId,
        coins,
        spins,
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unbekannte Aktion.", code: "UNBEKANNT" }, { status: 400 });
  } catch (err) {
    console.error("Gift-Fehler:", err);
    return NextResponse.json({ error: "Interner Fehler.", code: "INTERN" }, { status: 500 });
  }
}
