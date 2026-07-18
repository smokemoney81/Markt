import type { SupabaseClient } from "@supabase/supabase-js";

/** Rohdaten aus der Postgres-Funktion `game_analytics()`. */
interface RawAnalytics {
  players_total: number;
  players_active_1d: number;
  players_active_7d: number;
  players_active_30d: number;
  coins_circulating: number;
  spins_played: number;
  faucet_coins: number;
  spin_outcomes: Record<string, number>;
  revenue_cents: number;
  purchases_count: number;
  paying_users: number;
  reward_claims: number;
  reward_coins: number;
}

export interface Analytics extends RawAnalytics {
  /** Durchschnittlicher Umsatz je zahlendem Nutzer (in Cent). */
  arppu_cents: number;
  /** Durchschnittlicher Umsatz je Spieler (in Cent). */
  arpu_cents: number;
  /** Anteil zahlender Spieler in Prozent. */
  conversion_pct: number;
}

/** Berechnet die KPIs (Aggregat über alle Spieler). Nutzt den Service-Role-Client. */
export async function computeAnalytics(db: SupabaseClient): Promise<Analytics> {
  const { data, error } = await db.rpc("game_analytics");
  if (error) throw error;
  const a = data as RawAnalytics;
  const arppu = a.paying_users > 0 ? Math.round(a.revenue_cents / a.paying_users) : 0;
  const arpu = a.players_total > 0 ? Math.round(a.revenue_cents / a.players_total) : 0;
  const conversion = a.players_total > 0 ? (a.paying_users / a.players_total) * 100 : 0;
  return { ...a, arppu_cents: arppu, arpu_cents: arpu, conversion_pct: conversion };
}

/** Ist die E-Mail in der Admin-Allowlist (GAME_ADMIN_EMAILS, kommagetrennt)? */
export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false;
  const allow = (process.env.GAME_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allow.includes(email.toLowerCase());
}

// ======== Phase 17: Player Analytics ========

export interface PlayerStats {
  totalSpins: number;
  totalCoins: number;
  totalCoinsEarned: number;
  attacksWon: number;
  raidsWon: number;
  winRate: number;
  avgCoinsPerSpin: number;
  avgCoinsPerDay: number;
  avgSpinsPerDay: number;
  villageLevel: number;
  villageProgress: number;
  daysActive: number;
  lastSeenDaysAgo: number;
  streakDays: number;
  battlePassLevel: number;
  vipTier: number;
}

// ======== Phase 19: Weekly Challenge Progress ========

export interface ChallengeProgress {
  id: string;
  name: string;
  target: number;
  current: number;
  completed: boolean;
  reward: number;
  progress: number;
}

/**
 * Berechnet Progress für alle 5 wöchentlichen Challenges.
 * Basiert auf game_state + game_spin_log (aktuelle Woche).
 */
export async function getWeeklyChallenge(
  db: SupabaseClient,
  userId: string,
): Promise<ChallengeProgress[]> {
  const challenges = [
    { id: "spin_100", name: "100 Spins", target: 100, reward: 50 },
    { id: "build_5", name: "5 Gebäude fertigstellen", target: 5, reward: 200 },
    { id: "win_raid", name: "1 Raid gewinnen", target: 1, reward: 300 },
    { id: "collect_5k", name: "5000 Münzen sammeln", target: 5000, reward: 100 },
    { id: "max_shield", name: "Max. Schilde sammeln", target: 3, reward: 250 },
  ];

  const { data: state } = await db
    .from("game_state")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!state) {
    return challenges.map((c) => ({
      ...c,
      current: 0,
      completed: false,
      progress: 0,
    }));
  }

  // Diese Woche: Montag 00:00 bis Sonntag 23:59
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay()); // Montag
  weekStart.setHours(0, 0, 0, 0);

  // Spin-Logs dieser Woche laden
  const { data: weekLogs } = await db
    .from("game_spin_log")
    .select("result_type, coin_amount")
    .eq("user_id", userId)
    .gte("created_at", weekStart.toISOString());

  const logs = weekLogs || [];

  // Progress pro Challenge berechnen
  return challenges.map((challenge) => {
    let current = 0;
    let completed = false;

    switch (challenge.id) {
      case "spin_100": {
        // Spins diese Woche
        current = logs.length;
        completed = current >= challenge.target;
        break;
      }
      case "build_5": {
        // Gebäude fertiggestellt (über item_builds)
        // TODO: Würde komplexere Logik brauchen (build-logs)
        // Für now: Zähle aus state.items wie viele "built" sind
        const builtCount = (state.items || []).filter((item: string) => item === "built").length;
        current = builtCount; // Vereinfachte Näherung
        completed = current >= challenge.target;
        break;
      }
      case "win_raid": {
        // Raids gewonnen diese Woche
        const raidsWon = logs.filter((l) => l.result_type === "raid").length;
        current = raidsWon;
        completed = current >= challenge.target;
        break;
      }
      case "collect_5k": {
        // Münzen diese Woche
        current = logs.reduce((sum, log) => sum + (log.coin_amount || 0), 0);
        completed = current >= challenge.target;
        break;
      }
      case "max_shield": {
        // Aktuell gehaltene Schilde
        current = state.shields || 0;
        completed = current >= challenge.target;
        break;
      }
    }

    const progressPercent = Math.min(100, Math.round((current / challenge.target) * 100));

    return {
      ...challenge,
      current,
      completed,
      progress: progressPercent,
    };
  });
}

// ======== Phase 18: Achievement Unlocking ========

export interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: string;
  progress?: number;
  progressMax?: number;
}

/**
 * Prüft, welche Achievements ein Spieler freigeschalten hat.
 * Basiert auf game_state + game_spin_log.
 */
export async function getPlayerAchievements(
  db: SupabaseClient,
  userId: string,
): Promise<Achievement[]> {
  const achievements = [
    { id: "first_build", name: "Baumeister", description: "Erstes Gebäude fertig" },
    { id: "1000_spins", name: "Spinner", description: "1000 Spins total" },
    { id: "10_dorf", name: "Himmelstürmer", description: "Alle 10 Dörfer erreicht" },
    { id: "100_raids_won", name: "Kriegsheld", description: "100 Raids gewonnen" },
    { id: "all_sets", name: "Sammler", description: "Alle Kartensätze vollendet" },
    { id: "1M_coins", name: "Goldkönig", description: "1M Münzen verdient" },
    { id: "50_daily", name: "Gewohnheit", description: "50 Tage hintereinander" },
    { id: "jackpot_3", name: "Glückspilz", description: "3x Jackpot gewonnen" },
    { id: "vip_30", name: "VIP-Fan", description: "30 Tage VIP" },
    { id: "clan_10", name: "Teamplayer", description: "Clan mit 10 Mitgliedern" },
    { id: "seasonal_2", name: "Jahresmensch", description: "2 Seasons vollendet" },
    { id: "cosmetic_all", name: "Fashionista", description: "Alle Themes freigeschaltet" },
  ];

  // Spieler-Daten laden
  const { data: state } = await db
    .from("game_state")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (!state) return achievements.map((a) => ({ ...a, unlocked: false }));

  // Spin-Logs für Jackpot-Zählung laden
  const { data: logs } = await db
    .from("game_spin_log")
    .select("result_type, coin_amount")
    .eq("user_id", userId);

  const allLogs = logs || [];
  const jackpotCount = allLogs.filter((l) => l.result_type === "jackpot").length;

  // Achievement-Status berechnen
  const result: Achievement[] = achievements.map((ach) => {
    let unlocked = false;

    switch (ach.id) {
      case "first_build":
        // Mindestens ein Gebäude gebaut (items hat je mind. 1 "built")
        unlocked = state.items?.some((item: string) => item === "built") ?? false;
        break;
      case "1000_spins":
        unlocked = (state.total_spins ?? 0) >= 1000;
        break;
      case "10_dorf":
        unlocked = (state.village_index ?? 0) >= 9;
        break;
      case "100_raids_won":
        unlocked = (state.raids_won ?? 0) >= 100;
        break;
      case "all_sets":
        unlocked = (state.completed_sets?.length ?? 0) >= 5; // 5 Card Sets
        break;
      case "1M_coins":
        // Coins verdient (nicht aktuelle Münzen, sondern gesamt aus Spins)
        const totalEarned = allLogs.reduce((sum, log) => sum + (log.coin_amount || 0), 0);
        unlocked = totalEarned >= 1_000_000;
        break;
      case "50_daily":
        unlocked = (state.daily_streak ?? 0) >= 50;
        break;
      case "jackpot_3":
        unlocked = jackpotCount >= 3;
        break;
      case "vip_30":
        // VIP für 30+ Tage
        if (state.vip_tier && state.vip_tier > 0 && state.vip_expire_at) {
          const expireTime = new Date(state.vip_expire_at).getTime();
          const purchasedAt = expireTime - 30 * 24 * 60 * 60 * 1000; // 30 Tage zurück
          const now = Date.now();
          unlocked = purchasedAt <= now;
        }
        break;
      case "clan_10":
        // Clan mit 10+ Mitgliedern
        unlocked = state.clan_id !== null && false; // TODO: Clan-Member-Count prüfen
        break;
      case "seasonal_2":
        // 2+ Seasons vollendet (season_progress = 100)
        unlocked = false; // TODO: seasonal_progress Aggregation
        break;
      case "cosmetic_all":
        // Alle 4 Themes freigeschaltet
        const wheelUpgrades = state.wheel_upgrades || {};
        unlocked = Object.keys(wheelUpgrades).length >= 4;
        break;
    }

    return { ...ach, unlocked };
  });

  return result;
}

/**
 * Berechnet Player-Statistiken für die Analytics-Seite.
 * Ladet Game-State + Spin-Logs und aggregiert daraus KPIs.
 */
export async function getPlayerStats(
  db: SupabaseClient,
  userId: string,
): Promise<PlayerStats | null> {
  // Game-State laden
  const { data: state, error: stateError } = await db
    .from("game_state")
    .select(
      "coins, total_spins, attacks_won, raids_won, village_index, stars, daily_streak, last_seen_at, created_at, battle_pass_level, vip_tier",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (stateError || !state) return null;

  // Spin-Logs laden
  const { data: logs, error: logsError } = await db
    .from("game_spin_log")
    .select("coin_amount, result_type", { count: "exact" })
    .eq("user_id", userId);

  if (logsError) return null;

  const allLogs = logs || [];
  const totalCoinsEarned = allLogs.reduce((sum, log) => sum + (log.coin_amount || 0), 0);
  const totalWins = allLogs.filter((log) => ["attack", "raid"].includes(log.result_type)).length;

  // Tage aktiv
  const createdAt = new Date(state.created_at || Date.now()).getTime();
  const now = Date.now();
  const daysActive = Math.max(1, Math.floor((now - createdAt) / (1000 * 60 * 60 * 24)));

  const lastSeenAt = new Date(state.last_seen_at || now).getTime();
  const lastSeenDaysAgo = Math.floor((now - lastSeenAt) / (1000 * 60 * 60 * 24));

  const villageLevel = Math.min(10, (state.village_index ?? 0) + 1);
  const villageProgress = ((state.stars ?? 0) % 10) * 10;

  return {
    totalSpins: state.total_spins ?? 0,
    totalCoins: state.coins ?? 0,
    totalCoinsEarned,
    attacksWon: state.attacks_won ?? 0,
    raidsWon: state.raids_won ?? 0,
    winRate: state.total_spins ? Math.round((totalWins / state.total_spins) * 100) : 0,
    avgCoinsPerSpin: state.total_spins ? Math.floor(totalCoinsEarned / state.total_spins) : 0,
    avgCoinsPerDay: daysActive > 0 ? Math.floor(totalCoinsEarned / daysActive) : 0,
    avgSpinsPerDay: daysActive > 0 ? Math.floor(state.total_spins / daysActive) : 0,
    villageLevel,
    villageProgress,
    daysActive,
    lastSeenDaysAgo,
    streakDays: state.daily_streak ?? 0,
    battlePassLevel: state.battle_pass_level ?? 0,
    vipTier: state.vip_tier ?? 0,
  };
}
