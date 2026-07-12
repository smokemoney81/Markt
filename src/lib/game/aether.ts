/**
 * Spiellogik für "Aether Grid" – ein kleines Sci-Fi-Aufbau-/Raid-Spiel.
 * Reine, testbare Funktionen ohne DOM- oder React-Abhängigkeit.
 */

export type BuildingId = "reactor" | "mine" | "shield";

export type AetherState = {
  power: number;
  credits: number;
  energy: number;
  /** Verbleibende Bauzeit in Sekunden. 0 = Konstruktion fertig. */
  timeLeft: number;
  /** Grid-Level, abgeleitet aus der Macht (skaliert Raid-Belohnungen). */
  level: number;
  /** Anzahl Prestiges – jeder gibt einen dauerhaften Bonus. */
  prestige: number;
  /** Ausbaustufe je Gebäude. */
  buildings: Record<BuildingId, number>;
  /** Statistik: Gesamtzahl erfolgreicher Raids. */
  raids: number;
  bestPower: number;
  bestCredits: number;
  /** Gesamte Spielzeit in Sekunden. */
  playSeconds: number;
  /** Zeitpunkt (ms) des letzten Speicherns, für Offline-Fortschritt. */
  lastSeen: number;
};

export const BUILD_SECONDS = 300;
export const BOOST_SECONDS = 60;
export const BASE_MAX_ENERGY = 100;
/** Offline-Fortschritt maximal 8 Stunden anrechnen. */
export const MAX_OFFLINE_SECONDS = 8 * 3600;
/** Ab dieser Macht ist ein Prestige möglich. */
export const PRESTIGE_THRESHOLD = 1000;

export type AttackType = "PvE" | "PvP";

export const ATTACKS: Record<
  AttackType,
  { cost: number; gain: number; power: number; label: string }
> = {
  PvE: { cost: 10, gain: 50, power: 5, label: "Sektor Raid" },
  PvP: { cost: 20, gain: 150, power: 8, label: "Hacke Spieler" },
};

export const ENERGY_PACKS = [
  { amount: 20, cost: 100 },
  { amount: 60, cost: 250 },
] as const;

export const BUILDINGS: Record<
  BuildingId,
  {
    label: string;
    icon: string;
    desc: string;
    baseCost: number;
    costGrowth: number;
    maxLevel: number;
  }
> = {
  reactor: {
    label: "Reaktor",
    icon: "⚛️",
    desc: "+Energie-Regen/Sek",
    baseCost: 150,
    costGrowth: 1.55,
    maxLevel: 25,
  },
  mine: {
    label: "Aether-Mine",
    icon: "⛏️",
    desc: "+Credits/Sek",
    baseCost: 200,
    costGrowth: 1.6,
    maxLevel: 25,
  },
  shield: {
    label: "Schild-Array",
    icon: "🛡️",
    desc: "+Max-Energie & Macht",
    baseCost: 250,
    costGrowth: 1.7,
    maxLevel: 25,
  },
};

export const BUILDING_IDS: BuildingId[] = ["reactor", "mine", "shield"];

export function newGame(now: number = Date.now()): AetherState {
  return {
    power: 100,
    credits: 500,
    energy: 50,
    timeLeft: BUILD_SECONDS,
    level: 1,
    prestige: 0,
    buildings: { reactor: 0, mine: 0, shield: 0 },
    raids: 0,
    bestPower: 100,
    bestCredits: 500,
    playSeconds: 0,
    lastSeen: now,
  };
}

// ---------------------------------------------------------------------------
// Abgeleitete Werte
// ---------------------------------------------------------------------------

/** Dauerhafter Multiplikator aus Prestige (+10 % pro Prestige). */
export function prestigeMult(state: AetherState): number {
  return 1 + state.prestige * 0.1;
}

/** Grid-Level aus der Macht: alle 250 Macht ein Level. */
export function levelForPower(power: number): number {
  return 1 + Math.floor(power / 250);
}

/** Belohnungs-Skalierung durch das Grid-Level (+15 % pro Level). */
export function levelScale(level: number): number {
  return 1 + (level - 1) * 0.15;
}

export function maxEnergy(state: AetherState): number {
  return BASE_MAX_ENERGY + state.buildings.shield * 20;
}

/** Energie-Regeneration pro Sekunde (Reaktor). */
export function energyRegenPerSec(state: AetherState): number {
  return 0.25 + state.buildings.reactor * 0.25;
}

/** Passives Credits-Einkommen pro Sekunde (Mine × Prestige). */
export function creditsPerSec(state: AetherState): number {
  return state.buildings.mine * 1.5 * prestigeMult(state);
}

/** Kosten der nächsten Ausbaustufe eines Gebäudes. */
export function buildingCost(state: AetherState, id: BuildingId): number {
  const cfg = BUILDINGS[id];
  return Math.floor(cfg.baseCost * cfg.costGrowth ** state.buildings[id]);
}

// ---------------------------------------------------------------------------
// Zeit-Fortschritt (live-Tick & offline)
// ---------------------------------------------------------------------------

/** Rechnet `seconds` Sekunden Spielzeit an: Bauzeit, Regen, Einkommen, Stats. */
export function tick(state: AetherState, seconds: number): AetherState {
  if (seconds <= 0) return state;
  const cap = maxEnergy(state);
  const energy = Math.min(cap, state.energy + energyRegenPerSec(state) * seconds);
  const credits = state.credits + creditsPerSec(state) * seconds;
  const power = state.power;
  return {
    ...state,
    timeLeft: Math.max(0, state.timeLeft - seconds),
    energy,
    credits,
    level: levelForPower(power),
    playSeconds: state.playSeconds + seconds,
    bestPower: Math.max(state.bestPower, power),
    bestCredits: Math.max(state.bestCredits, Math.floor(credits)),
  };
}

/** Rechnet vergangene Echtzeit (gedeckelt) auf den Spielstand an. */
export function applyElapsed(
  state: AetherState,
  now: number = Date.now()
): AetherState {
  const elapsedSec = Math.min(
    MAX_OFFLINE_SECONDS,
    Math.max(0, Math.floor((now - state.lastSeen) / 1000))
  );
  return { ...tick(state, elapsedSec), lastSeen: now };
}

// ---------------------------------------------------------------------------
// Aktionen
// ---------------------------------------------------------------------------

export type ActionResult = {
  state: AetherState;
  ok: boolean;
  message: string;
};

/** Quantum-Boost: verkürzt die Bauzeit um eine Minute. */
export function boost(state: AetherState): ActionResult {
  if (state.timeLeft <= 0) {
    return { state, ok: false, message: "Konstruktion bereits fertig!" };
  }
  const timeLeft = Math.max(0, state.timeLeft - BOOST_SECONDS);
  return {
    state: { ...state, timeLeft },
    ok: true,
    message: "Quantum-Boost: −1 Min!",
  };
}

export function attack(state: AetherState, type: AttackType): ActionResult {
  const cfg = ATTACKS[type];
  if (state.energy < cfg.cost) {
    return { state, ok: false, message: "Nicht genug Energie!" };
  }
  const mult = levelScale(state.level) * prestigeMult(state);
  const gain = Math.round(cfg.gain * mult);
  const power = state.power + cfg.power;
  return {
    state: {
      ...state,
      energy: state.energy - cfg.cost,
      credits: state.credits + gain,
      power,
      level: levelForPower(power),
      raids: state.raids + 1,
      bestPower: Math.max(state.bestPower, power),
    },
    ok: true,
    message: `${type} erfolgreich! +${gain} Credits`,
  };
}

export function buyEnergy(
  state: AetherState,
  amount: number,
  cost: number
): ActionResult {
  if (state.credits < cost) {
    return { state, ok: false, message: "Zu wenig Credits!" };
  }
  return {
    state: {
      ...state,
      credits: state.credits - cost,
      energy: Math.min(maxEnergy(state), state.energy + amount),
    },
    ok: true,
    message: `Energie +${amount}!`,
  };
}

export function upgradeBuilding(
  state: AetherState,
  id: BuildingId
): ActionResult {
  const cfg = BUILDINGS[id];
  const cur = state.buildings[id];
  if (cur >= cfg.maxLevel) {
    return { state, ok: false, message: `${cfg.label} ist maximal ausgebaut!` };
  }
  const cost = buildingCost(state, id);
  if (state.credits < cost) {
    return { state, ok: false, message: "Zu wenig Credits!" };
  }
  return {
    state: {
      ...state,
      credits: state.credits - cost,
      buildings: { ...state.buildings, [id]: cur + 1 },
    },
    ok: true,
    message: `${cfg.label} → Stufe ${cur + 1}!`,
  };
}

export function canPrestige(state: AetherState): boolean {
  return state.power >= PRESTIGE_THRESHOLD;
}

/** Wie viele Prestige-Punkte ein Reset aktuell einbringt. */
export function prestigeGainFor(state: AetherState): number {
  return Math.floor(state.power / PRESTIGE_THRESHOLD);
}

/** Setzt Fortschritt zurück, behält Statistik und gewährt Prestige-Boni. */
export function prestige(state: AetherState): ActionResult {
  if (!canPrestige(state)) {
    return {
      state,
      ok: false,
      message: `Prestige ab ${PRESTIGE_THRESHOLD} Macht!`,
    };
  }
  const gain = prestigeGainFor(state);
  const fresh = newGame(state.lastSeen);
  return {
    state: {
      ...fresh,
      prestige: state.prestige + gain,
      // Statistik bleibt erhalten.
      raids: state.raids,
      bestPower: state.bestPower,
      bestCredits: state.bestCredits,
      playSeconds: state.playSeconds,
    },
    ok: true,
    message: `Prestige! +${gain} Aether-Kern${gain > 1 ? "e" : ""}`,
  };
}

// ---------------------------------------------------------------------------
// Formatierung
// ---------------------------------------------------------------------------

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${rest < 10 ? "0" + rest : rest}`;
}

/** Spielzeit als "1h 23m" / "5m 12s". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${rest}s`;
  return `${rest}s`;
}

/** Große Zahlen kompakt: 1234 → "1,2K". */
export function formatNum(n: number): string {
  const v = Math.floor(n);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1).replace(".", ",") + "M";
  if (v >= 10_000) return (v / 1000).toFixed(1).replace(".", ",") + "K";
  return v.toLocaleString("de-DE");
}
