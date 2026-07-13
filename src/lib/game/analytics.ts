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
