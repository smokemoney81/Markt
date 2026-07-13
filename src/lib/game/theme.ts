/**
 * Progressives UI-Theming: pro Dorf ändert sich Farbpalette und Glow-Intensität,
 * damit der Spieler beim Aufstieg sichtbar in ein "höheres" Setting kommt
 * (dunkel & schlicht in Dorf 1-3, futuristisch-neon in Dorf 8-10).
 *
 * Die Werte werden als CSS-Variablen auf den Game-Root gesetzt und von der
 * UI genutzt (siehe CoinMasterGame.tsx). Keine Framer-Motion-Abhängigkeit
 * nötig – ein `transition: … 500ms` an den Konsumenten reicht für den Wechsel.
 */
import { VILLAGES } from "./coinmaster";

export interface LevelTheme {
  /** Primärfarbe – Slot-Border, Hauptakzent. */
  primary: string;
  /** Sekundärfarbe – zweiter Akzent, Verläufe. */
  secondary: string;
  /** Hintergrund-Gradient des Slot-Panels (from → to). */
  panelFrom: string;
  panelTo: string;
  /** Innerer Hintergrund der Walzen. */
  reelBg: string;
  /** Box-Shadow-Intensität (0-1) für das Slot-Panel. */
  glow: number;
  /** Zusätzlicher Text-Shadow für die Dorf-Überschrift. */
  headingGlow: string;
  /** Menschlich lesbarer Stufen-Name für Anzeige. */
  tierLabel: string;
}

/**
 * Ordnet villageIndex (0-9) einer der 4 UI-Stufen zu.
 *
 * Grober Plan aus dem Konzept:
 *  - Stufe 1 (Dorf 1-3): einfach, dunkel, wenig Glow
 *  - Stufe 2 (Dorf 4-5): mehr Farbe, mittlerer Glow
 *  - Stufe 3 (Dorf 6-7): neon, hoher Glow
 *  - Stufe 4 (Dorf 8-10): futuristisch, maximaler Glow
 */
export function levelTier(villageIndex: number): 1 | 2 | 3 | 4 {
  if (villageIndex <= 2) return 1;
  if (villageIndex <= 4) return 2;
  if (villageIndex <= 6) return 3;
  return 4;
}

const THEMES: Record<1 | 2 | 3 | 4, LevelTheme> = {
  1: {
    primary: "234 179 8", // yellow-500 – vertrauter Slot-Look
    secondary: "6 182 212", // cyan-500
    panelFrom: "#241a2e",
    panelTo: "#0e141b",
    reelBg: "#120d17",
    glow: 0.25,
    headingGlow: "none",
    tierLabel: "Novize",
  },
  2: {
    primary: "34 224 255", // brand cyan
    secondary: "244 114 182", // pink-400
    panelFrom: "#1b1a3a",
    panelTo: "#0e141b",
    reelBg: "#0f0f1e",
    glow: 0.45,
    headingGlow: "0 0 6px rgb(34 224 255 / 0.55)",
    tierLabel: "Kämpfer",
  },
  3: {
    primary: "0 255 255", // Neon-Cyan
    secondary: "255 0 150", // Neon-Pink
    panelFrom: "#1a2440",
    panelTo: "#0a1020",
    reelBg: "#0a1424",
    glow: 0.65,
    headingGlow: "0 0 10px rgb(0 255 255 / 0.75)",
    tierLabel: "Neon-Held",
  },
  4: {
    primary: "0 255 255",
    secondary: "255 60 180",
    panelFrom: "#241a48",
    panelTo: "#080614",
    reelBg: "#0a0820",
    glow: 0.9,
    headingGlow: "0 0 14px rgb(255 60 180 / 0.85), 0 0 6px rgb(0 255 255 / 0.6)",
    tierLabel: "Space-Master",
  },
};

export function getLevelTheme(villageIndex: number): LevelTheme {
  const idx = Math.max(0, Math.min(VILLAGES.length - 1, villageIndex));
  return THEMES[levelTier(idx)];
}

/** CSS-Variablen für inline-Style-Objekt – wird auf den Game-Root gesetzt. */
export function themeCssVars(theme: LevelTheme): Record<string, string> {
  return {
    "--lvl-primary": theme.primary,
    "--lvl-secondary": theme.secondary,
    "--lvl-panel-from": theme.panelFrom,
    "--lvl-panel-to": theme.panelTo,
    "--lvl-reel-bg": theme.reelBg,
    "--lvl-glow": String(theme.glow),
    "--lvl-heading-glow": theme.headingGlow,
  };
}
