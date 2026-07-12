/**
 * Spiellogik für "Aether Grid" – ein kleines Sci-Fi-Aufbau-/Raid-Spiel.
 * Reine, testbare Funktionen ohne DOM- oder React-Abhängigkeit.
 */

export type AetherState = {
  power: number;
  credits: number;
  energy: number;
  /** Verbleibende Bauzeit in Sekunden. 0 = Konstruktion fertig. */
  timeLeft: number;
  /** Zeitpunkt (ms) des letzten Speicherns, für Offline-Fortschritt. */
  lastSeen: number;
};

export const MAX_ENERGY = 100;
export const BUILD_SECONDS = 300;
export const BOOST_SECONDS = 60;

export type AttackType = "PvE" | "PvP";

export const ATTACKS: Record<
  AttackType,
  { cost: number; gain: number; power: number; label: string }
> = {
  PvE: { cost: 10, gain: 50, power: 5, label: "Sektor Raid" },
  PvP: { cost: 20, gain: 150, power: 5, label: "Hacke Spieler" },
};

export const ENERGY_PACKS = [
  { amount: 20, cost: 100 },
  { amount: 60, cost: 250 },
] as const;

export function newGame(now: number = Date.now()): AetherState {
  return {
    power: 100,
    credits: 500,
    energy: 50,
    timeLeft: BUILD_SECONDS,
    lastSeen: now,
  };
}

/** Rechnet vergangene Echtzeit auf die Bauzeit an. */
export function applyElapsed(
  state: AetherState,
  now: number = Date.now()
): AetherState {
  const elapsedSec = Math.max(0, Math.floor((now - state.lastSeen) / 1000));
  return {
    ...state,
    timeLeft: Math.max(0, state.timeLeft - elapsedSec),
    lastSeen: now,
  };
}

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
  return {
    state: {
      ...state,
      energy: state.energy - cfg.cost,
      credits: state.credits + cfg.gain,
      power: state.power + cfg.power,
    },
    ok: true,
    message: `${type} erfolgreich! +${cfg.gain} Credits`,
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
      energy: Math.min(MAX_ENERGY, state.energy + amount),
    },
    ok: true,
    message: `Energie +${amount}!`,
  };
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}:${rest < 10 ? "0" + rest : rest}`;
}
