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
