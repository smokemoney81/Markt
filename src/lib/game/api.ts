"use client";

/**
 * Client-Anbindung an die serverautoritativen Spiel-Routen.
 * Der Client kennt nur noch das Ergebnis – gewürfelt und verbucht wird auf
 * dem Server. Zum Verdrahten der bestehenden UI (`CoinMasterGame.tsx`) genügt
 * es, die lokalen State-Mutationen durch diese Aufrufe zu ersetzen.
 */
import type { ActionResponse } from "./server";
import type { PurchaseResult, RewardResult, ShopOverview } from "./shop";
import type { GameState, OfflineAttackNews } from "./coinmaster";

async function post<T = ActionResponse>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new GameApiError(data?.code ?? "FEHLER", data?.error ?? "Unbekannter Fehler.");
  }
  return data as T;
}

export class GameApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "GameApiError";
  }
}

export interface FetchStateResult {
  state: GameState;
  news: OfflineAttackNews[];
  buildsCompleted?: number[];
  villageCompleted?: { name: string; rewardSpins: number; rewardCoins: number };
}

export async function fetchState(): Promise<FetchStateResult> {
  const res = await fetch("/api/spiel/state");
  const data = await res.json();
  if (!res.ok) throw new GameApiError(data?.code ?? "FEHLER", data?.error ?? "Fehler beim Laden.");
  return data;
}

export const spin = (bet?: number) => post("/api/spiel/spin", { bet });
export const build = (slot: number) => post("/api/spiel/build", { slot });
export const buyChest = (chestId: string) => post("/api/spiel/chest", { chestId });
export const claimDaily = () => post("/api/spiel/daily");
export const setBet = (bet: number) => post("/api/spiel/bet", { bet });
export const resetGame = () => post("/api/spiel/reset");

// ---------- Shop / Monetarisierung ----------

export async function fetchShop(): Promise<ShopOverview> {
  const res = await fetch("/api/spiel/shop");
  const data = await res.json();
  if (!res.ok) throw new GameApiError(data?.code ?? "FEHLER", data?.error ?? "Shop nicht verfügbar.");
  return data;
}

export const claimReward = (adToken?: string) => post<RewardResult>("/api/spiel/reward", { adToken });
export const purchase = (productId: string, receipt?: string) =>
  post<PurchaseResult>("/api/spiel/purchase", { productId, receipt });

/**
 * Startet den Kauf. Mit Stripe kommt `{ url }` zurück (Weiterleitung zur
 * Bezahlseite); im Test-Modus `{ granted, state }` (sofort gutgeschrieben).
 */
export type CheckoutResult =
  | { url: string }
  | { granted: true; state: GameState };

export const checkout = (productId: string) =>
  post<CheckoutResult>("/api/spiel/checkout", { productId });

// ---------- Phasen 5-16 APIs ----------

export const claimBattlePass = (tier: number) =>
  post("/api/spiel/actions", { action: "battle-pass-claim", params: { tier } });

export const joinClan = (clanId: string) =>
  post("/api/spiel/actions", { action: "clan-join", params: { clanId } });

export const leaveClan = () =>
  post("/api/spiel/actions", { action: "clan-leave" });

export const unlockAchievement = (index: number) =>
  post("/api/spiel/actions", { action: "achievement-unlock", params: { index } });

export const selectTheme = (theme: "default" | "neon" | "cyber" | "mystic") =>
  post("/api/spiel/actions", { action: "theme-select", params: { theme } });

export const upgradeWheel = (upgrade: string, cost: number) =>
  post("/api/spiel/actions", { action: "wheel-upgrade", params: { upgrade, cost } });

export const completeQuest = (index: number) =>
  post("/api/spiel/actions", { action: "quest-complete", params: { index } });

export const purchaseVip = (tier: 1 | 2 | 3, days?: number) =>
  post("/api/spiel/actions", { action: "vip-purchase", params: { tier, days } });

export const addFriend = (friendId: string) =>
  post("/api/spiel/actions", { action: "friend-add", params: { friendId } });

export const removeFriend = (friendId: string) =>
  post("/api/spiel/actions", { action: "friend-remove", params: { friendId } });

export async function fetchLeaderboard(period: string = "global", limit: number = 10) {
  const res = await fetch(`/api/spiel/leaderboard?period=${period}&limit=${limit}`);
  const data = await res.json();
  if (!res.ok) throw new GameApiError(data?.code ?? "FEHLER", data?.error ?? "Fehler beim Laden.");
  return data;
}

export async function fetchCosmetics() {
  const res = await fetch("/api/spiel/cosmetics");
  const data = await res.json();
  if (!res.ok) throw new GameApiError(data?.code ?? "FEHLER", data?.error ?? "Fehler beim Laden.");
  return data;
}

export async function fetchFriends() {
  const res = await fetch("/api/spiel/friends");
  const data = await res.json();
  if (!res.ok) throw new GameApiError(data?.code ?? "FEHLER", data?.error ?? "Fehler beim Laden.");
  return data;
}

export const sendGift = (recipientId: string, coins: number, spins: number) =>
  post("/api/spiel/friends", { action: "send-gift", recipientId, coins, spins });
