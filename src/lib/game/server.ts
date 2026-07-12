/**
 * Serverautoritative Spiel-Ökonomie für Münz-Meister.
 *
 * Der Spielstand liegt in `public.game_state` (siehe Migration 0002). Jede
 * Coin-/Spin-Mutation läuft über die reinen Aktions-Funktionen hier und wird
 * mit dem Service-Role-Client persistiert – der Client kann den Kontostand
 * nicht direkt schreiben (RLS erlaubt nur SELECT der eigenen Zeile).
 *
 * Wichtig: Die Ökonomie-Regeln kommen weiterhin ausschließlich aus
 * `coinmaster.ts` (single source of truth). Diese Datei ist nur die
 * serverseitige Anwendung + Persistenz derselben pure functions.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BET_STEPS,
  CARD_SETS,
  CHESTS,
  DAILY_BONUS_HOURS,
  MAX_SHIELDS,
  VILLAGES,
  applyRegen,
  chestCost,
  itemCost,
  makeAttack,
  makeRaid,
  newGame,
  openChest,
  repairCost,
  rollDailyReward,
  rollOfflineAttacks,
  rollOutcome,
  shuffle,
  villageScale,
  type AttackSetup,
  type Card,
  type CardSet,
  type DailyReward,
  type Enemy,
  type GameState,
  type ItemState,
  type OfflineAttackNews,
  type SpinOutcome,
} from "./coinmaster";

// ---------- DB-Zeile ----------

interface GameRow {
  user_id: string;
  coins: number;
  spins: number;
  shields: number;
  stars: number;
  bet: number;
  village_index: number;
  items: ItemState[];
  cards: Record<string, number>;
  completed_sets: string[];
  last_regen_at: string;
  last_daily_at: string | null;
  last_seen_at: string;
  total_spins: number;
  attacks_won: number;
  raids_won: number;
}

const ms = (iso: string | null): number => (iso ? new Date(iso).getTime() : 0);
const iso = (millis: number): string | null =>
  millis > 0 ? new Date(millis).toISOString() : null;

function rowToState(row: GameRow): GameState {
  return {
    coins: Number(row.coins),
    spins: row.spins,
    shields: row.shields,
    stars: row.stars,
    bet: row.bet,
    villageIndex: row.village_index,
    items: row.items,
    cards: row.cards,
    completedSets: row.completed_sets,
    lastRegenAt: ms(row.last_regen_at),
    lastDailyAt: ms(row.last_daily_at),
    lastSeenAt: ms(row.last_seen_at),
    totalSpins: row.total_spins,
    attacksWon: row.attacks_won,
    raidsWon: row.raids_won,
  };
}

/** Spalten für ein Update/Insert aus dem TS-State. */
function stateToRow(state: GameState) {
  return {
    coins: state.coins,
    spins: state.spins,
    shields: state.shields,
    stars: state.stars,
    bet: state.bet,
    village_index: state.villageIndex,
    items: state.items,
    cards: state.cards,
    completed_sets: state.completedSets,
    last_regen_at: iso(state.lastRegenAt),
    last_daily_at: iso(state.lastDailyAt),
    last_seen_at: iso(state.lastSeenAt),
    total_spins: state.totalSpins,
    attacks_won: state.attacksWon,
    raids_won: state.raidsWon,
    updated_at: new Date().toISOString(),
  };
}

// ---------- IO ----------

/** Lädt den Spielstand oder legt beim ersten Zugriff einen neuen an. */
export async function loadOrCreateState(
  db: SupabaseClient,
  userId: string,
): Promise<GameState> {
  const { data, error } = await db
    .from("game_state")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (data) return rowToState(data as GameRow);

  const fresh = newGame();
  const { error: insertError } = await db
    .from("game_state")
    .insert({ user_id: userId, ...stateToRow(fresh) });
  if (insertError) throw insertError;
  return fresh;
}

/**
 * Lädt den Stand und wendet beim Öffnen Regeneration + Offline-Angriffe an
 * (wie der Client bisher beim Start). Persistiert das Ergebnis und liefert
 * zusätzlich die Angriffs-News für die UI zurück.
 */
export async function refreshState(
  db: SupabaseClient,
  userId: string,
): Promise<{ state: GameState; news: OfflineAttackNews[] }> {
  const now = Date.now();
  let state = await loadOrCreateState(db, userId);
  state = applyRegen(state, now);
  const { state: afterAttacks, news } = rollOfflineAttacks(state, now);
  await persistState(db, userId, afterAttacks);
  return { state: afterAttacks, news };
}

/** Schreibt den kompletten State autoritativ zurück. */
export async function persistState(
  db: SupabaseClient,
  userId: string,
  state: GameState,
): Promise<void> {
  const { error } = await db
    .from("game_state")
    .update(stateToRow(state))
    .eq("user_id", userId);
  if (error) throw error;
}

async function logSpin(
  db: SupabaseClient,
  userId: string,
  resultType: SpinOutcome["kind"],
  coinAmount: number,
  bet: number,
): Promise<void> {
  await db
    .from("game_spin_log")
    .insert({
      user_id: userId,
      result_type: resultType,
      coin_amount: coinAmount,
      bet,
    });
}

// ---------- Reine Aktionen (Server-Autorität) ----------

export interface SpinResult {
  outcome: SpinOutcome;
  /** Tatsächlich gutgeschriebene Coins (für Log & UI). */
  coinsGained: number;
  /**
   * Vorgewürfelte Kampf-Details für die Enthüllungs-Animation im Client.
   * Der Ausgang ist bereits serverseitig entschieden und verbucht – die UI
   * zeigt ihn nur noch an (Coin Master lässt tippen, das Ergebnis steht fest).
   */
  combat?: {
    attack?: AttackSetup;
    raid?: { enemy: Enemy; holes: number[]; dug: number[] };
  };
}

/**
 * Führt einen Spin komplett serverseitig aus. Kampf-Ergebnisse (attack/raid)
 * werden autoritativ vorgewürfelt und sofort gutgeschrieben – das Minispiel
 * im Client ist reine Enthüllungs-Animation. (Interaktive Kampfauflösung mit
 * echtem „Loch wählen" ist ein sauberer Folgeschritt über pending sessions.)
 */
export function performSpin(input: GameState, betInput: number): { state: GameState; result: SpinResult } {
  const bet = normalizeBet(betInput);
  if (input.spins < bet) {
    throw new GameError("NICHT_GENUG_SPINS", "Nicht genügend Spins.");
  }

  const outcome = rollOutcome(input.villageIndex, bet);
  const scale = villageScale(input.villageIndex);
  let state: GameState = {
    ...input,
    bet,
    spins: input.spins - bet,
    totalSpins: input.totalSpins + 1,
  };
  let coinsGained = 0;
  let combat: SpinResult["combat"];

  switch (outcome.kind) {
    case "coins":
    case "jackpot":
      coinsGained = outcome.coins;
      state = { ...state, coins: state.coins + coinsGained };
      break;
    case "energy":
      state = { ...state, spins: state.spins + outcome.spins };
      break;
    case "shield":
      if (state.shields >= MAX_SHIELDS) {
        coinsGained = 5_000 * scale; // Trostpreis wie im Client
        state = { ...state, coins: state.coins + coinsGained };
      } else {
        state = { ...state, shields: Math.min(MAX_SHIELDS, state.shields + 1) };
      }
      break;
    case "attack": {
      const setup = makeAttack(state.villageIndex, bet);
      coinsGained = setup.blocked ? setup.rewardBlocked : setup.rewardSuccess;
      state = {
        ...state,
        coins: state.coins + coinsGained,
        attacksWon: state.attacksWon + (setup.blocked ? 0 : 1),
      };
      combat = { attack: setup };
      break;
    }
    case "raid": {
      const setup = makeRaid(state.villageIndex, bet);
      // Autoritativ: 3 der 4 Löcher werden gehoben (1 zufälliges bleibt liegen).
      const dugIndices = shuffle([0, 1, 2, 3]).slice(0, 3);
      coinsGained = dugIndices.reduce((s, i) => s + setup.holes[i], 0);
      state = {
        ...state,
        coins: state.coins + coinsGained,
        raidsWon: state.raidsWon + (coinsGained > 0 ? 1 : 0),
      };
      combat = { raid: { enemy: setup.enemy, holes: setup.holes, dug: dugIndices } };
      break;
    }
    case "nothing":
      break;
  }

  return { state, result: { outcome, coinsGained, combat } };
}

export interface BuildResult {
  slot: number;
  repaired: boolean;
  /** Gesetzt, wenn durch den Bau ein Dorf abgeschlossen wurde. */
  villageCompleted?: { name: string; rewardSpins: number; rewardCoins: number };
}

/** Baut oder repariert ein Dorf-Objekt und steigt ggf. ins nächste Dorf auf. */
export function performBuild(input: GameState, slot: number): { state: GameState; result: BuildResult } {
  if (slot < 0 || slot >= input.items.length) {
    throw new GameError("UNGUELTIGER_SLOT", "Ungültiger Bauplatz.");
  }
  const current = input.items[slot];
  if (current === "built") {
    throw new GameError("BEREITS_GEBAUT", "Objekt ist bereits gebaut.");
  }
  const repaired = current === "damaged";
  const cost = repaired ? repairCost(input.villageIndex, slot) : itemCost(input.villageIndex, slot);
  if (input.coins < cost) {
    throw new GameError("NICHT_GENUG_COINS", "Nicht genügend Münzen.");
  }

  const items = [...input.items];
  items[slot] = "built";
  let state: GameState = {
    ...input,
    items,
    coins: input.coins - cost,
    stars: input.stars + (current === "none" ? 1 : 0),
  };
  const result: BuildResult = { slot, repaired };

  if (items.every((it) => it === "built") && state.villageIndex < VILLAGES.length - 1) {
    const rewardSpins = 25;
    const rewardCoins = 50_000 * villageScale(state.villageIndex);
    result.villageCompleted = {
      name: VILLAGES[state.villageIndex].name,
      rewardSpins,
      rewardCoins,
    };
    state = {
      ...state,
      villageIndex: state.villageIndex + 1,
      items: ["none", "none", "none", "none", "none"],
      spins: state.spins + rewardSpins,
      coins: state.coins + rewardCoins,
    };
  }

  return { state, result };
}

export interface ChestResult {
  cards: Card[];
  completedSet?: CardSet;
}

/** Kauft eine Truhe, zieht Karten und prüft Set-Abschlüsse. */
export function performChest(input: GameState, chestId: string): { state: GameState; result: ChestResult } {
  const chest = CHESTS.find((c) => c.id === chestId);
  if (!chest) {
    throw new GameError("UNBEKANNTE_TRUHE", "Unbekannte Truhe.");
  }
  const cost = chestCost(chest, input.villageIndex);
  if (input.coins < cost) {
    throw new GameError("NICHT_GENUG_COINS", "Nicht genügend Münzen.");
  }

  const drawn = openChest(chest);
  const cards = { ...input.cards };
  for (const c of drawn) cards[c.id] = (cards[c.id] ?? 0) + 1;

  let state: GameState = { ...input, coins: input.coins - cost, cards };
  const result: ChestResult = { cards: drawn };

  for (const set of CARD_SETS) {
    if (state.completedSets.includes(set.name)) continue;
    if (set.cards.every((c) => (cards[c.id] ?? 0) > 0)) {
      result.completedSet = set;
      state = {
        ...state,
        completedSets: [...state.completedSets, set.name],
        spins: state.spins + set.rewardSpins,
        coins: state.coins + set.rewardCoins,
      };
      break;
    }
  }

  return { state, result };
}

/** Löst den Tagesbonus ein (falls verfügbar). */
export function performDaily(input: GameState, now: number): { state: GameState; result: DailyReward } {
  const ready = now - input.lastDailyAt >= DAILY_BONUS_HOURS * 3_600_000;
  if (!ready) {
    throw new GameError("BONUS_NICHT_BEREIT", "Tagesbonus noch nicht verfügbar.");
  }
  const reward = rollDailyReward(input.villageIndex);
  const state: GameState = {
    ...input,
    lastDailyAt: now,
    spins: input.spins + reward.spins,
    coins: input.coins + reward.coins,
  };
  return { state, result: reward };
}

/** Setzt die eingestellte Wette (persistiert für spätere Spins). */
export function performSetBet(input: GameState, betInput: number): GameState {
  return { ...input, bet: normalizeBet(betInput) };
}

// ---------- Helfer ----------

function normalizeBet(bet: number): number {
  return BET_STEPS.includes(bet) ? bet : BET_STEPS[0];
}

/** Fehler mit Code, den die Route-Handler in eine 4xx-Antwort übersetzen. */
export class GameError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "GameError";
  }
}

// ---------- High-Level Orchestrierung für die Route-Handler ----------

export type GameAction =
  | { type: "spin"; bet?: number }
  | { type: "build"; slot: number }
  | { type: "chest"; chestId: string }
  | { type: "daily" }
  | { type: "setBet"; bet: number }
  | { type: "reset" };

export interface ActionResponse {
  state: GameState;
  spin?: SpinResult;
  build?: BuildResult;
  chest?: ChestResult;
  daily?: DailyReward;
}

/**
 * Lädt den Stand, wendet Regeneration + Offline-Angriffe an, führt die Aktion
 * aus, persistiert und protokolliert. Einzige Schreibstelle für Spielaktionen.
 */
export async function runAction(
  db: SupabaseClient,
  userId: string,
  action: GameAction,
): Promise<ActionResponse> {
  const now = Date.now();
  let state = await loadOrCreateState(db, userId);

  if (action.type === "reset") {
    state = newGame();
    await persistState(db, userId, state);
    return { state };
  }

  // Regeneration immer zuerst anwenden (serverseitig, manipulationssicher).
  state = applyRegen(state, now);

  const response: ActionResponse = { state };

  switch (action.type) {
    case "spin": {
      const { state: next, result } = performSpin(state, action.bet ?? state.bet);
      state = next;
      response.spin = result;
      await logSpin(db, userId, result.outcome.kind, result.coinsGained, state.bet);
      break;
    }
    case "build": {
      const { state: next, result } = performBuild(state, action.slot);
      state = next;
      response.build = result;
      break;
    }
    case "chest": {
      const { state: next, result } = performChest(state, action.chestId);
      state = next;
      response.chest = result;
      break;
    }
    case "daily": {
      const { state: next, result } = performDaily(state, now);
      state = next;
      response.daily = result;
      break;
    }
    case "setBet": {
      state = performSetBet(state, action.bet);
      break;
    }
  }

  await persistState(db, userId, state);
  response.state = state;
  return response;
}
