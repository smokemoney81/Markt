import { NextResponse } from "next/server";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  gainBattlePassXp,
  claimBattlePassReward,
  joinClan,
  leaveClan,
  unlockAchievement,
  selectTheme,
  upgradeWheel,
  completeDailyQuest,
  purchaseVip,
  addFriend,
  removeFriend,
  type GameState,
} from "@/lib/game/coinmaster";

export const dynamic = "force-dynamic";

interface ActionBody {
  action: "battle-pass-claim" | "clan-join" | "clan-leave" | "achievement-unlock" | "theme-select" | "wheel-upgrade" | "quest-complete" | "vip-purchase" | "friend-add" | "friend-remove";
  params?: Record<string, unknown>;
}

async function loadState(service: ReturnType<typeof createServiceClient>, userId: string): Promise<GameState | null> {
  const { data } = await service.from("game_state").select("*").eq("user_id", userId).single();
  if (!data) return null;
  // Konvertierung würde hier erfolgen (nutzen wir server.ts Funktion)
  return data as unknown as GameState;
}

async function saveState(service: ReturnType<typeof createServiceClient>, userId: string, state: GameState): Promise<void> {
  await service.from("game_state").update({
    battle_pass_level: state.battlePassLevel,
    battle_pass_xp: state.battlePassXp,
    achievement_bits: state.achievementBits,
    selected_theme: state.selectedTheme,
    wheel_upgrades: state.wheelUpgrades,
    daily_quest_bits: state.dailyQuestBits,
    vip_tier: state.vipTier,
    vip_expire_at: state.vipExpireAt ? new Date(state.vipExpireAt).toISOString() : null,
    friend_ids: state.friendIds,
  }).eq("user_id", userId);
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
    const body = (await req.json()) as ActionBody;
    const service = createServiceClient();
    let state = await loadState(service, user.id);
    if (!state) {
      return NextResponse.json({ error: "Spielstand nicht gefunden.", code: "NICHT_GEFUNDEN" }, { status: 404 });
    }

    switch (body.action) {
      case "battle-pass-claim": {
        const tier = (body.params?.tier as number) ?? 1;
        state = claimBattlePassReward(state, tier);
        break;
      }
      case "clan-join": {
        const clanId = body.params?.clanId as string;
        if (clanId) state = joinClan(state, clanId);
        break;
      }
      case "clan-leave": {
        state = leaveClan(state);
        break;
      }
      case "achievement-unlock": {
        const idx = (body.params?.index as number) ?? 0;
        state = unlockAchievement(state, idx);
        break;
      }
      case "theme-select": {
        const theme = body.params?.theme as "default" | "neon" | "cyber" | "mystic";
        if (theme) state = selectTheme(state, theme);
        break;
      }
      case "wheel-upgrade": {
        const upgrade = body.params?.upgrade as string;
        const cost = (body.params?.cost as number) ?? 0;
        if (upgrade) state = upgradeWheel(state, upgrade, cost);
        break;
      }
      case "quest-complete": {
        const idx = (body.params?.index as number) ?? 0;
        state = completeDailyQuest(state, idx);
        break;
      }
      case "vip-purchase": {
        const tier = (body.params?.tier as 1 | 2 | 3) ?? 1;
        const days = (body.params?.days as number) ?? 30;
        state = purchaseVip(state, tier, days);
        break;
      }
      case "friend-add": {
        const friendId = body.params?.friendId as string;
        if (friendId) state = addFriend(state, friendId);
        break;
      }
      case "friend-remove": {
        const friendId = body.params?.friendId as string;
        if (friendId) state = removeFriend(state, friendId);
        break;
      }
    }

    await saveState(service, user.id, state);
    return NextResponse.json({ state });
  } catch (err) {
    console.error("Aktion-Fehler:", err);
    return NextResponse.json({ error: "Interner Fehler.", code: "INTERN" }, { status: 500 });
  }
}
