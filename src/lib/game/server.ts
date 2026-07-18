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
  applyBuildProgress,
  applyRegen,
  buildDurationSeconds,
  chestCost,
  itemCost,
  makeAttack,
  makeRaid,
  newGame,
  nextStreak,
  openChest,
  repairCost,
  rollDailyReward,
  rollOfflineAttacks,
  rollOutcome,
  shuffle,
  villageScale,
  type AttackSetup,
  type BuildJob,
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

/**
 * DB-Repräsentation eines Bau-Jobs: doneAt als ISO-Timestamp (nicht ms),
 * damit die Zeile im Supabase-Dashboard lesbar bleibt.
 */
interface BuildJobRow {
  doneAt: string;
  repair: boolean;
}

interface GameRow {
  user_id: string;
  coins: number;
  spins: number;
  shields: number;
  stars: number;
  bet: number;
  village_index: number;
  items: ItemState[];
  item_builds: Record<string, BuildJobRow> | null;
  item_levels: Record<string, number> | null;
  cards: Record<string, number>;
  completed_sets: string[];
  last_regen_at: string;
  last_daily_at: string | null;
  daily_streak: number | null;
  last_seen_at: string;
  total_spins: number;
  attacks_won: number;
  raids_won: number;
  version: number;
  // Phase 5
  battle_pass_level: number | null;
  battle_pass_xp: number | null;
  // Phase 6
  clan_id: string | null;
  // Phase 8
  weekly_challenge_bits: number | null;
  last_weekly_challenge_reset: string | null;
  // Phase 9
  achievement_bits: number | null;
  // Phase 10
  current_season_id: string | null;
  season_progress: number | null;
  // Phase 11
  selected_theme: string | null;
  // Phase 13
  wheel_upgrades: Record<string, number> | null;
  // Phase 14
  daily_quest_bits: number | null;
  last_daily_quest_reset: string | null;
  // Phase 15
  vip_tier: number | null;
  vip_expire_at: string | null;
  // Phase 16
  friend_ids: string[] | null;
}

const ms = (iso: string | null): number => (iso ? new Date(iso).getTime() : 0);
const iso = (millis: number): string | null =>
  millis > 0 ? new Date(millis).toISOString() : null;

function buildsFromRow(raw: Record<string, BuildJobRow> | null | undefined): Record<number, BuildJob> {
  if (!raw) return {};
  const out: Record<number, BuildJob> = {};
  for (const [k, v] of Object.entries(raw)) {
    const slot = Number(k);
    if (!Number.isInteger(slot)) continue;
    out[slot] = { doneAt: ms(v.doneAt), repair: !!v.repair };
  }
  return out;
}

function levelsFromRow(raw: Record<string, number> | null | undefined): Record<number, number> {
  if (!raw) return {};
  const out: Record<number, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    const slot = Number(k);
    if (!Number.isInteger(slot)) continue;
    out[slot] = Math.max(1, Math.min(50, Number(v) || 1));
  }
  return out;
}

function levelsToRow(levels: Record<number, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(levels)) {
    out[k] = Math.max(1, Math.min(50, v));
  }
  return out;
}

function buildsToRow(builds: Record<number, BuildJob>): Record<string, BuildJobRow> {
  const out: Record<string, BuildJobRow> = {};
  for (const [k, v] of Object.entries(builds)) {
    const isoTime = iso(v.doneAt);
    if (isoTime) out[k] = { doneAt: isoTime, repair: v.repair };
  }
  return out;
}

function rowToState(row: GameRow): GameState {
  return {
    coins: Number(row.coins),
    spins: row.spins,
    shields: row.shields,
    stars: row.stars,
    bet: row.bet,
    villageIndex: row.village_index,
    items: row.items,
    itemBuilds: buildsFromRow(row.item_builds),
    itemLevels: levelsFromRow(row.item_levels),
    cards: row.cards,
    completedSets: row.completed_sets,
    lastRegenAt: ms(row.last_regen_at),
    lastDailyAt: ms(row.last_daily_at),
    dailyStreak: row.daily_streak ?? 0,
    lastSeenAt: ms(row.last_seen_at),
    totalSpins: row.total_spins,
    attacksWon: row.attacks_won,
    raidsWon: row.raids_won,
    battlePassLevel: row.battle_pass_level ?? 0,
    battlePassXp: row.battle_pass_xp ?? 0,
    clanId: row.clan_id ?? null,
    weeklyChallengeBits: row.weekly_challenge_bits ?? 0,
    lastWeeklyChallengeReset: ms(row.last_weekly_challenge_reset),
    achievementBits: row.achievement_bits ?? 0,
    currentSeasonId: row.current_season_id ?? "spring",
    seasonProgress: row.season_progress ?? 0,
    selectedTheme: (row.selected_theme ?? "default") as "default" | "neon" | "cyber" | "mystic",
    wheelUpgrades: row.wheel_upgrades ?? {},
    dailyQuestBits: row.daily_quest_bits ?? 0,
    lastDailyQuestReset: ms(row.last_daily_quest_reset),
    vipTier: (row.vip_tier ?? 0) as 0 | 1 | 2 | 3,
    vipExpireAt: ms(row.vip_expire_at),
    friendIds: row.friend_ids ?? [],
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
    item_builds: buildsToRow(state.itemBuilds),
    item_levels: levelsToRow(state.itemLevels),
    cards: state.cards,
    completed_sets: state.completedSets,
    last_regen_at: iso(state.lastRegenAt),
    last_daily_at: iso(state.lastDailyAt),
    daily_streak: state.dailyStreak,
    last_seen_at: iso(state.lastSeenAt),
    total_spins: state.totalSpins,
    attacks_won: state.attacksWon,
    raids_won: state.raidsWon,
    battle_pass_level: state.battlePassLevel,
    battle_pass_xp: state.battlePassXp,
    clan_id: state.clanId,
    weekly_challenge_bits: state.weeklyChallengeBits,
    last_weekly_challenge_reset: iso(state.lastWeeklyChallengeReset),
    achievement_bits: state.achievementBits,
    current_season_id: state.currentSeasonId,
    season_progress: state.seasonProgress,
    selected_theme: state.selectedTheme,
    wheel_upgrades: state.wheelUpgrades,
    daily_quest_bits: state.dailyQuestBits,
    last_daily_quest_reset: iso(state.lastDailyQuestReset),
    vip_tier: state.vipTier,
    vip_expire_at: iso(state.vipExpireAt),
    friend_ids: state.friendIds,
    updated_at: new Date().toISOString(),
  };
}

// ---------- IO ----------

/**
 * Konflikt beim optimistischen Locking: Die Zeile wurde zwischen Laden und
 * Schreiben von einem parallelen Request verändert (Version passte nicht mehr).
 * Der Aufrufer lädt neu und wendet die Logik erneut an (siehe withVersionRetry).
 */
export class VersionConflictError extends Error {
  constructor() {
    super("Spielstand wurde parallel verändert (Version-Konflikt).");
    this.name = "VersionConflictError";
  }
}

/** Spielstand inkl. der beim Laden gelesenen Version (für den Version-Guard). */
export interface LoadedState {
  state: GameState;
  version: number;
}

/**
 * Lädt den Spielstand inkl. Version oder legt beim ersten Zugriff einen neuen
 * an. Bei einem parallelen Erst-Insert (PK-Konflikt) wird einmal neu geladen.
 */
export async function loadStateVersioned(
  db: SupabaseClient,
  userId: string,
): Promise<LoadedState> {
  const { data, error } = await db
    .from("game_state")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (data) {
    const row = data as GameRow;
    return { state: rowToState(row), version: Number(row.version ?? 0) };
  }

  const fresh = newGame();
  const { error: insertError } = await db
    .from("game_state")
    .insert({ user_id: userId, ...stateToRow(fresh), version: 0 });
  if (insertError) {
    // Paralleler Erst-Insert desselben Nutzers → Zeile existiert jetzt.
    if (insertError.code === "23505") {
      const { data: again, error: againError } = await db
        .from("game_state")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (againError) throw againError;
      if (again) {
        const row = again as GameRow;
        return { state: rowToState(row), version: Number(row.version ?? 0) };
      }
    }
    throw insertError;
  }
  return { state: fresh, version: 0 };
}

/** Lädt den Spielstand oder legt beim ersten Zugriff einen neuen an. */
export async function loadOrCreateState(
  db: SupabaseClient,
  userId: string,
): Promise<GameState> {
  return (await loadStateVersioned(db, userId)).state;
}

/**
 * Führt eine Load-modify-write-Operation mit optimistischem Locking aus und
 * wiederholt sie bei Version-Konflikt (bounded). Die übergebene Funktion muss
 * den Stand SELBST laden (loadStateVersioned) und mit persistState(..., version)
 * schreiben, damit jeder Versuch auf frischen Daten arbeitet.
 */
export async function withVersionRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      if (e instanceof VersionConflictError) {
        lastError = e;
        continue;
      }
      throw e;
    }
  }
  throw lastError ?? new VersionConflictError();
}

export interface RefreshResult {
  state: GameState;
  news: OfflineAttackNews[];
  buildsCompleted?: number[];
  villageCompleted?: { name: string; rewardSpins: number; rewardCoins: number };
}

/**
 * Lädt den Stand und wendet beim Öffnen Regeneration, Bau-Fortschritt und
 * Offline-Angriffe an. Persistiert das Ergebnis und liefert zusätzlich die
 * Angriffs-News sowie eventuelle Bau-Fertigstellungen für die UI zurück.
 */
export async function refreshState(db: SupabaseClient, userId: string): Promise<RefreshResult> {
  return withVersionRetry(async () => {
    const now = Date.now();
    const loaded = await loadStateVersioned(db, userId);
    let state = applyRegen(loaded.state, now);
    const progress = applyBuildProgress(state, now);
    state = progress.state;
    const { state: afterAttacks, news } = rollOfflineAttacks(state, now);
    await persistState(db, userId, afterAttacks, loaded.version);
    return {
      state: afterAttacks,
      news,
      ...(progress.completedSlots.length > 0 && { buildsCompleted: progress.completedSlots }),
      ...(progress.villageCompleted && { villageCompleted: progress.villageCompleted }),
    };
  });
}

/**
 * Schreibt den kompletten State autoritativ zurück – mit optimistischem
 * Locking. Das UPDATE greift nur, wenn die Version noch der beim Laden
 * gelesenen entspricht; sie wird dabei um 1 erhöht. Trifft parallel bereits
 * eine höhere Version zu, schreibt das UPDATE 0 Zeilen → VersionConflictError.
 */
export async function persistState(
  db: SupabaseClient,
  userId: string,
  state: GameState,
  expectedVersion: number,
): Promise<number> {
  const nextVersion = expectedVersion + 1;
  const { data, error } = await db
    .from("game_state")
    .update({ ...stateToRow(state), version: nextVersion })
    .eq("user_id", userId)
    .eq("version", expectedVersion)
    .select("version");
  if (error) throw error;
  if (!data || data.length === 0) throw new VersionConflictError();
  return nextVersion;
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
  repair: boolean;
  /** Fertigstellungs-Zeitstempel (ms) für Client-Countdown. */
  doneAt: number;
}

/**
 * Startet einen Bau-Timer für den Slot. Die tatsächliche Umwandlung in
 * "built" (inkl. Sterne + evtl. Dorf-Aufstieg) passiert erst, wenn die
 * Bauzeit abgelaufen ist – autoritativ in `applyBuildProgress` bei der
 * nächsten Aktion. So kann der Client den Fortschritt nicht manipulieren.
 */
export function performBuild(
  input: GameState,
  slot: number,
  now: number,
): { state: GameState; result: BuildResult } {
  if (slot < 0 || slot >= input.items.length) {
    throw new GameError("UNGUELTIGER_SLOT", "Ungültiger Bauplatz.");
  }
  if (input.itemBuilds[slot]) {
    throw new GameError("BEREITS_IM_BAU", "Slot wird bereits gebaut.");
  }
  const current = input.items[slot];
  if (current === "damaged") {
    throw new GameError("BESCHAEDIGT", "Gebäude ist beschädigt, reparieren erforderlich.");
  }

  const currentLevel = input.itemLevels[slot] ?? (current === "built" ? 1 : 0);
  const repair = false;
  const isUpgrade = current === "built" && currentLevel < 50;
  const cost = isUpgrade ? itemCost(input.villageIndex, slot, currentLevel) : itemCost(input.villageIndex, slot, 1);
  if (input.coins < cost) {
    throw new GameError("NICHT_GENUG_COINS", "Nicht genügend Münzen.");
  }

  const doneAt = now + buildDurationSeconds(input.villageIndex, slot, repair) * 1000;
  const state: GameState = {
    ...input,
    coins: input.coins - cost,
    itemBuilds: { ...input.itemBuilds, [slot]: { doneAt, repair } },
  };
  return { state, result: { slot, repair, doneAt } };
}

export interface ChestResult {
  cards: Card[];
  /**
   * ALLE Sets, die durch diese Truhe gleichzeitig komplettiert wurden. Eine
   * Truhe kann mehrere Karten ziehen und damit mehr als ein Set auf einmal
   * abschließen – alle werden erkannt und belohnt.
   */
  completedSets?: CardSet[];
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

  // ALLE gleichzeitig komplettierten Sets erkennen und belohnen (kein `break`):
  // Eine Truhe kann mehrere Karten ziehen und damit mehr als ein Set auf einmal
  // abschließen.
  const completedSets: CardSet[] = [];
  for (const set of CARD_SETS) {
    if (state.completedSets.includes(set.name)) continue;
    if (set.cards.every((c) => (cards[c.id] ?? 0) > 0)) {
      completedSets.push(set);
      state = {
        ...state,
        completedSets: [...state.completedSets, set.name],
        spins: state.spins + set.rewardSpins,
        coins: state.coins + set.rewardCoins,
      };
    }
  }
  if (completedSets.length > 0) result.completedSets = completedSets;

  return { state, result };
}

/** Löst den Tagesbonus ein (falls verfügbar). */
export function performDaily(input: GameState, now: number): { state: GameState; result: DailyReward } {
  const ready = now - input.lastDailyAt >= DAILY_BONUS_HOURS * 3_600_000;
  if (!ready) {
    throw new GameError("BONUS_NICHT_BEREIT", "Tagesbonus noch nicht verfügbar.");
  }
  const streak = nextStreak(input.dailyStreak, input.lastDailyAt, now);
  const reward = rollDailyReward(input.villageIndex, streak);
  const state: GameState = {
    ...input,
    lastDailyAt: now,
    dailyStreak: streak,
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
  /**
   * Bau-Fertigstellungen, die durch diese Aktion (bzw. den Zeitablauf
   * seit dem letzten Aufruf) autoritativ ausgelöst wurden. Wird auch von
   * `refreshState` mitgeliefert – der Client zeigt dann die Objekte als
   * "gebaut" an bzw. löst das Level-Up-Overlay aus.
   */
  buildsCompleted?: number[];
  villageCompleted?: { name: string; rewardSpins: number; rewardCoins: number };
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
  return withVersionRetry(async () => {
    const now = Date.now();
    const loaded = await loadStateVersioned(db, userId);
    let state = loaded.state;

    if (action.type === "reset") {
      state = newGame();
      await persistState(db, userId, state, loaded.version);
      return { state };
    }

    // Regeneration + Bau-Fortschritt immer zuerst anwenden
    // (serverseitig, manipulationssicher). So werden abgelaufene Bau-Timer
    // vor jeder Aktion in "built" umgewandelt und evtl. das Dorf komplettiert.
    state = applyRegen(state, now);
    const progress = applyBuildProgress(state, now);
    state = progress.state;

    const response: ActionResponse = { state };
    if (progress.completedSlots.length > 0) response.buildsCompleted = progress.completedSlots;
    if (progress.villageCompleted) response.villageCompleted = progress.villageCompleted;

    // Ergebnis eines Spins erst NACH erfolgreichem Persist loggen (siehe unten),
    // sonst hinterlässt eine fehlgeschlagene/konfliktbehaftete Persistenz eine
    // Faucet-/Analytics-Geisterzeile bzw. loggt bei Retry doppelt.
    let spinToLog: { kind: SpinOutcome["kind"]; coins: number; bet: number } | null = null;

    switch (action.type) {
      case "spin": {
        const { state: next, result } = performSpin(state, action.bet ?? state.bet);
        state = next;
        response.spin = result;
        spinToLog = { kind: result.outcome.kind, coins: result.coinsGained, bet: state.bet };
        break;
      }
      case "build": {
        const { state: next, result } = performBuild(state, action.slot, now);
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

    await persistState(db, userId, state, loaded.version);
    if (spinToLog) {
      await logSpin(db, userId, spinToLog.kind, spinToLog.coins, spinToLog.bet);
    }
    response.state = state;
    return response;
  });
}
