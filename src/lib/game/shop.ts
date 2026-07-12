/**
 * Monetarisierung für Münz-Meister – serverautoritativ.
 *
 * Zwei Hebel:
 *  1. Rewarded Loop (`claimReward`): täglich gedeckelte Gratis-Belohnung.
 *     Retention-Hook; wird zum Rewarded-Ad, sobald ein Ad-Netzwerk-Token
 *     an derselben Stelle verifiziert wird (Seam `verifyAdToken`).
 *  2. Shop-Käufe (`purchase`): echter Umsatz. Der eigentliche Zahlungs-
 *     nachweis läuft über `verifyPurchase` – ohne konfigurierten Anbieter
 *     wird bewusst NICHTS gutgeschrieben (kein „free money").
 *
 * Alle Gutschriften gehen über den Service-Role-Client; RLS erlaubt Nutzern
 * nur SELECT der eigenen Zeilen.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_SHIELDS, type GameState } from "./coinmaster";
import { GameError, loadOrCreateState, persistState } from "./server";

// ---------- Belohnungen ----------

export interface Grant {
  coins?: number;
  spins?: number;
  shields?: number;
}

/** Täglich gedeckelte Gratis-Belohnung (Rewarded Loop). */
export const REWARD_GRANT: Grant = { coins: 10_000, spins: 2 };
export const REWARD_DAILY_CAP = 5;

// ---------- Shop-Katalog ----------

export interface ShopProduct {
  id: string;
  label: string;
  description: string;
  priceCents: number;
  currency: string;
  /** Einmalig kaufbar (z. B. Starter-Paket)? */
  once?: boolean;
  grant: Grant;
}

export const SHOP_PRODUCTS: ShopProduct[] = [
  {
    id: "starter_pack",
    label: "Starter-Paket",
    description: "100.000 Münzen + 25 Spins + volle Schilde",
    priceCents: 299,
    currency: "EUR",
    once: true,
    grant: { coins: 100_000, spins: 25, shields: MAX_SHIELDS },
  },
  { id: "spins_15", label: "15 Spins", description: "15 Spins sofort", priceCents: 199, currency: "EUR", grant: { spins: 15 } },
  { id: "spins_60", label: "60 Spins", description: "60 Spins – bester Wert", priceCents: 599, currency: "EUR", grant: { spins: 60 } },
  { id: "coins_s", label: "Münzen S", description: "150.000 Münzen", priceCents: 199, currency: "EUR", grant: { coins: 150_000 } },
  { id: "coins_m", label: "Münzen M", description: "500.000 Münzen", priceCents: 499, currency: "EUR", grant: { coins: 500_000 } },
  { id: "coins_l", label: "Münzen L", description: "1,2 Mio. Münzen", priceCents: 999, currency: "EUR", grant: { coins: 1_200_000 } },
];

// ---------- Grant auf den State anwenden ----------

function applyGrant(state: GameState, grant: Grant): GameState {
  return {
    ...state,
    coins: state.coins + (grant.coins ?? 0),
    spins: state.spins + (grant.spins ?? 0),
    shields: Math.min(MAX_SHIELDS, state.shields + (grant.shields ?? 0)),
  };
}

function startOfUtcDayIso(now: number): string {
  const d = new Date(now);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

async function logReward(
  db: SupabaseClient,
  userId: string,
  kind: "reward" | "purchase",
  grant: Grant,
  productId?: string,
): Promise<void> {
  await db.from("game_reward_log").insert({
    user_id: userId,
    kind,
    product_id: productId ?? null,
    coins: grant.coins ?? 0,
    spins: grant.spins ?? 0,
    shields: grant.shields ?? 0,
  });
}

// ---------- Rewarded Loop ----------

export interface RewardStatus {
  usedToday: number;
  cap: number;
  remaining: number;
}

async function rewardStatus(db: SupabaseClient, userId: string, now: number): Promise<RewardStatus> {
  const { count, error } = await db
    .from("game_reward_log")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("kind", "reward")
    .gte("created_at", startOfUtcDayIso(now));
  if (error) throw error;
  const usedToday = count ?? 0;
  return { usedToday, cap: REWARD_DAILY_CAP, remaining: Math.max(0, REWARD_DAILY_CAP - usedToday) };
}

export interface ShopOverview {
  products: ShopProduct[];
  reward: RewardStatus;
  /** IDs bereits gekaufter Einmal-Produkte. */
  ownedOnce: string[];
}

/** Katalog + Rewarded-Status + bereits gekaufte Einmal-Produkte. */
export async function shopOverview(db: SupabaseClient, userId: string): Promise<ShopOverview> {
  const now = Date.now();
  const reward = await rewardStatus(db, userId, now);
  const { data } = await db
    .from("game_purchases")
    .select("product_id")
    .eq("user_id", userId)
    .eq("status", "granted");
  const owned = new Set((data ?? []).map((r) => (r as { product_id: string }).product_id));
  const ownedOnce = SHOP_PRODUCTS.filter((p) => p.once && owned.has(p.id)).map((p) => p.id);
  return { products: SHOP_PRODUCTS, reward, ownedOnce };
}

export interface RewardResult {
  state: GameState;
  grant: Grant;
  status: RewardStatus;
}

/** Löst eine gedeckelte Gratis-Belohnung ein (Rewarded Loop). */
export async function claimReward(db: SupabaseClient, userId: string, adToken?: string): Promise<RewardResult> {
  const now = Date.now();
  const before = await rewardStatus(db, userId, now);
  if (before.remaining <= 0) {
    throw new GameError("TAGESLIMIT_ERREICHT", "Tageslimit für Gratis-Belohnungen erreicht.");
  }
  // Seam: sobald ein Ad-Netzwerk aktiv ist, hier den Completion-Token prüfen.
  await verifyAdToken(adToken);

  const state = applyGrant(await loadOrCreateState(db, userId), REWARD_GRANT);
  await persistState(db, userId, state);
  await logReward(db, userId, "reward", REWARD_GRANT);

  const status: RewardStatus = {
    usedToday: before.usedToday + 1,
    cap: REWARD_DAILY_CAP,
    remaining: before.remaining - 1,
  };
  return { state, grant: REWARD_GRANT, status };
}

// ---------- Käufe ----------

export interface PurchaseResult {
  state: GameState;
  product: ShopProduct;
}

/** Wirft, wenn ein Einmal-Produkt bereits gewährt wurde. */
export async function assertNotOwned(db: SupabaseClient, userId: string, product: ShopProduct): Promise<void> {
  if (!product.once) return;
  const { count } = await db
    .from("game_purchases")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("product_id", product.id)
    .eq("status", "granted");
  if ((count ?? 0) > 0) {
    throw new GameError("BEREITS_GEKAUFT", "Dieses Produkt wurde bereits gekauft.");
  }
}

/**
 * Verbucht einen (bereits bezahlten) Kauf und schreibt die Gegenstände gut.
 * Idempotent über `unique(provider, provider_ref)`: Der Kauf wird ZUERST
 * eingefügt – schlägt das mit Unique-Konflikt fehl (z. B. Stripe-Webhook-
 * Retry), wurde bereits gewährt und es passiert nichts weiter.
 *
 * Aufrufer garantiert, dass die Zahlung verifiziert ist (Test-Modus oder
 * signierter Stripe-Webhook).
 */
export async function recordAndGrant(
  db: SupabaseClient,
  userId: string,
  product: ShopProduct,
  provider: string,
  providerRef: string,
  amountCents: number,
): Promise<{ state?: GameState; alreadyGranted: boolean }> {
  const { error: insErr } = await db.from("game_purchases").insert({
    user_id: userId,
    product_id: product.id,
    provider,
    provider_ref: providerRef,
    amount_cents: amountCents,
    currency: product.currency,
    status: "granted",
  });
  if (insErr) {
    if (insErr.code === "23505") return { alreadyGranted: true }; // Duplikat → schon gewährt
    throw insErr;
  }

  const state = applyGrant(await loadOrCreateState(db, userId), product.grant);
  await persistState(db, userId, state);
  await logReward(db, userId, "purchase", product.grant, product.id);
  return { state, alreadyGranted: false };
}

/**
 * Direkter Kauf (nur Test-Modus ohne echten Anbieter). Der reguläre Kauf-Flow
 * läuft über die Checkout-Route + Stripe-Webhook.
 */
export async function purchase(
  db: SupabaseClient,
  userId: string,
  productId: string,
  receipt?: string,
): Promise<PurchaseResult> {
  const product = SHOP_PRODUCTS.find((p) => p.id === productId);
  if (!product) {
    throw new GameError("UNBEKANNTES_PRODUKT", "Unbekanntes Produkt.");
  }
  await assertNotOwned(db, userId, product);

  const { provider, providerRef } = await verifyPurchase(product, receipt);
  const res = await recordAndGrant(db, userId, product, provider, providerRef ?? `${provider}_${Date.now()}`, product.priceCents);
  if (res.alreadyGranted || !res.state) {
    throw new GameError("KAUF_KONFLIKT", "Kauf konnte nicht verbucht werden (evtl. Duplikat).");
  }
  return { state: res.state, product };
}

// ---------- Verifikations-Nahtstellen ----------

/**
 * Prüft den Ad-Completion-Token. Ohne konfiguriertes Ad-Netzwerk läuft der
 * Rewarded Loop als reiner (gedeckelter) Retention-Faucet – der Token wird
 * dann nicht erzwungen. Sobald ein Netzwerk aktiv ist, hier serverseitig
 * gegen dessen Callback verifizieren.
 */
async function verifyAdToken(_token?: string): Promise<void> {
  // TODO: Ad-Netzwerk-Verifikation (z. B. AdMob SSV) einhängen.
}

/**
 * Prüft den Zahlungsnachweis. Ohne konfigurierten Zahlungsanbieter wird
 * bewusst KEIN Kauf gewährt (verhindert „free money"). Mit
 * `PAYMENTS_TEST_MODE=true` wird für lokale Tests ohne echten Anbieter
 * durchgelassen (provider='test').
 */
async function verifyPurchase(
  product: ShopProduct,
  receipt?: string,
): Promise<{ provider: string; providerRef: string | null }> {
  if (process.env.PAYMENTS_TEST_MODE === "true") {
    return { provider: "test", providerRef: receipt ?? `test_${product.id}_${Date.now()}` };
  }
  // TODO: echten Anbieter einhängen (Stripe-Session / Google-Play-Receipt).
  throw new GameError(
    "ZAHLUNG_NICHT_KONFIGURIERT",
    "Käufe sind noch nicht aktiviert (kein Zahlungsanbieter konfiguriert).",
  );
}
