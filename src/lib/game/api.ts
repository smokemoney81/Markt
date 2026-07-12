"use client";

/**
 * Client-Anbindung an die serverautoritativen Spiel-Routen.
 * Der Client kennt nur noch das Ergebnis – gewürfelt und verbucht wird auf
 * dem Server. Zum Verdrahten der bestehenden UI (`CoinMasterGame.tsx`) genügt
 * es, die lokalen State-Mutationen durch diese Aufrufe zu ersetzen.
 */
import type { ActionResponse } from "./server";
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

export async function fetchState(): Promise<{ state: GameState; news: OfflineAttackNews[] }> {
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
