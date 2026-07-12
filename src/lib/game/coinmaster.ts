/**
 * Coin-Master-Clone – Spieldaten & pure Logik.
 * Alle Balancing-Werte sind hier zentral einstellbar.
 */

// ---------- Konstanten (Balancing) ----------

export const MAX_SPINS = 50; // Regeneration füllt nur bis hierhin auf
export const SPIN_REGEN_SECONDS = 180; // 1 Spin alle 3 Minuten
export const MAX_SHIELDS = 3;
export const DAILY_BONUS_HOURS = 20; // Tagesbonus alle 20 h (wie im Original)
export const BET_STEPS = [1, 2, 3, 5, 10];
export const REPAIR_FACTOR = 0.3; // Reparatur kostet 30 % des Baupreises
export const START_SPINS = 50;
export const START_COINS = 25_000;

// ---------- Typen ----------

export type SlotSymbol = "coin" | "bag" | "energy" | "hammer" | "pig" | "shield";

export type SpinOutcome =
  | { kind: "attack" }
  | { kind: "raid" }
  | { kind: "shield" }
  | { kind: "energy"; spins: number }
  | { kind: "jackpot"; coins: number }
  | { kind: "coins"; coins: number; count: number }
  | { kind: "nothing" };

export type ItemState = "none" | "built" | "damaged";

export type CardId = string;

export interface GameState {
  coins: number;
  spins: number;
  shields: number;
  stars: number;
  bet: number;
  villageIndex: number;
  /** Zustand der 5 Dorf-Objekte des aktuellen Dorfs */
  items: ItemState[];
  /** Karten-Besitz: cardId -> Anzahl */
  cards: Record<CardId, number>;
  /** Bereits eingelöste (komplette) Sets */
  completedSets: string[];
  /** Zeitstempel (ms) für Spin-Regeneration */
  lastRegenAt: number;
  /** Zeitstempel (ms) des letzten Tagesbonus */
  lastDailyAt: number;
  /** Zeitstempel (ms) des letzten Besuchs (für Offline-Angriffe) */
  lastSeenAt: number;
  /** Statistik */
  totalSpins: number;
  attacksWon: number;
  raidsWon: number;
}

export interface VillageItem {
  name: string;
  emoji: string;
}

export interface Village {
  name: string;
  emoji: string;
  items: VillageItem[];
}

export interface Enemy {
  name: string;
  emoji: string;
}

export interface Card {
  id: CardId;
  name: string;
  emoji: string;
  /** Seltenheit 1–5 Sterne */
  rarity: number;
}

export interface CardSet {
  name: string;
  emoji: string;
  cards: Card[];
  /** Belohnung in Spins beim Vervollständigen */
  rewardSpins: number;
  rewardCoins: number;
}

export interface Chest {
  id: "wood" | "gold" | "magic";
  name: string;
  emoji: string;
  cardCount: number;
  /** Grundpreis, wird mit dem Dorf-Level multipliziert */
  baseCost: number;
  /** Gewichtung für seltene Karten (höher = bessere Karten) */
  luck: number;
}

// ---------- Dörfer ----------

export const VILLAGES: Village[] = [
  {
    name: "Wikingerdorf",
    emoji: "🛶",
    items: [
      { name: "Langhaus", emoji: "🏠" },
      { name: "Drachenboot", emoji: "🛶" },
      { name: "Schmiede", emoji: "⚒️" },
      { name: "Runenstein", emoji: "🪨" },
      { name: "Palisade", emoji: "🪵" },
    ],
  },
  {
    name: "Ritterburg",
    emoji: "🏰",
    items: [
      { name: "Burgturm", emoji: "🏰" },
      { name: "Zugbrücke", emoji: "🌉" },
      { name: "Thronsaal", emoji: "👑" },
      { name: "Pferdestall", emoji: "🐴" },
      { name: "Wehrmauer", emoji: "🧱" },
    ],
  },
  {
    name: "Piratenbucht",
    emoji: "🏴‍☠️",
    items: [
      { name: "Piratenschiff", emoji: "⛵" },
      { name: "Taverne", emoji: "🍺" },
      { name: "Leuchtturm", emoji: "🗼" },
      { name: "Kanone", emoji: "💣" },
      { name: "Schatzhöhle", emoji: "🪙" },
    ],
  },
  {
    name: "Wüstenoase",
    emoji: "🏜️",
    items: [
      { name: "Beduinenzelt", emoji: "⛺" },
      { name: "Brunnen", emoji: "⛲" },
      { name: "Palmenhain", emoji: "🌴" },
      { name: "Basar", emoji: "🏺" },
      { name: "Kamelstall", emoji: "🐪" },
    ],
  },
  {
    name: "Eisland",
    emoji: "🧊",
    items: [
      { name: "Iglu", emoji: "🏔️" },
      { name: "Hundeschlitten", emoji: "🛷" },
      { name: "Eisbär-Statue", emoji: "🐻‍❄️" },
      { name: "Feuerstelle", emoji: "🔥" },
      { name: "Fischerhütte", emoji: "🎣" },
    ],
  },
  {
    name: "Dschungeltempel",
    emoji: "🌿",
    items: [
      { name: "Steintempel", emoji: "🗿" },
      { name: "Hängebrücke", emoji: "🌉" },
      { name: "Totem", emoji: "🪆" },
      { name: "Wasserfall", emoji: "💦" },
      { name: "Baumhütte", emoji: "🌳" },
    ],
  },
  {
    name: "Drachenhort",
    emoji: "🐉",
    items: [
      { name: "Drachennest", emoji: "🥚" },
      { name: "Schatzkammer", emoji: "💎" },
      { name: "Wachturm", emoji: "🗼" },
      { name: "Feuertor", emoji: "🔥" },
      { name: "Opferaltar", emoji: "🕯️" },
    ],
  },
  {
    name: "Raumstation",
    emoji: "🚀",
    items: [
      { name: "Rakete", emoji: "🚀" },
      { name: "Wohnkuppel", emoji: "🛖" },
      { name: "Labor", emoji: "🔬" },
      { name: "Antenne", emoji: "📡" },
      { name: "Roboter", emoji: "🤖" },
    ],
  },
  {
    name: "Unterwasserwelt",
    emoji: "🌊",
    items: [
      { name: "Korallenpalast", emoji: "🪸" },
      { name: "U-Boot", emoji: "🛟" },
      { name: "Muschelthron", emoji: "🐚" },
      { name: "Riffgarten", emoji: "🐠" },
      { name: "Leuchtqualle", emoji: "🎐" },
    ],
  },
  {
    name: "Götterolymp",
    emoji: "⚡",
    items: [
      { name: "Zeustempel", emoji: "🏛️" },
      { name: "Säulenhalle", emoji: "🏟️" },
      { name: "Blitzstatue", emoji: "⚡" },
      { name: "Ambrosia-Garten", emoji: "🍇" },
      { name: "Wolkentor", emoji: "☁️" },
    ],
  },
];

// ---------- Gegner ----------

export const ENEMIES: Enemy[] = [
  { name: "Hans Häuptling", emoji: "🧔" },
  { name: "Greta Goldzahn", emoji: "👩‍🦰" },
  { name: "Bruno Bärenkralle", emoji: "🐻" },
  { name: "Frieda Feuerfaust", emoji: "🔥" },
  { name: "Otto der Ork", emoji: "👹" },
  { name: "Kalle Krähe", emoji: "🐦‍⬛" },
  { name: "Wilma Wirbelwind", emoji: "🌪️" },
  { name: "Sigi Säbelzahn", emoji: "🐯" },
  { name: "Edda Eisenherz", emoji: "🛡️" },
  { name: "Ragnar Raffgier", emoji: "💰" },
];

// ---------- Karten ----------

export const CARD_SETS: CardSet[] = [
  {
    name: "Haustiere",
    emoji: "🐾",
    rewardSpins: 25,
    rewardCoins: 50_000,
    cards: [
      { id: "pet-1", name: "Wachhund", emoji: "🐕", rarity: 1 },
      { id: "pet-2", name: "Stubentiger", emoji: "🐈", rarity: 1 },
      { id: "pet-3", name: "Goldhamster", emoji: "🐹", rarity: 2 },
      { id: "pet-4", name: "Plapperpapagei", emoji: "🦜", rarity: 3 },
      { id: "pet-5", name: "Schlaue Füchsin", emoji: "🦊", rarity: 4 },
      { id: "pet-6", name: "Weiser Uhu", emoji: "🦉", rarity: 5 },
    ],
  },
  {
    name: "Wikinger",
    emoji: "⚔️",
    rewardSpins: 40,
    rewardCoins: 100_000,
    cards: [
      { id: "vik-1", name: "Hornhelm", emoji: "🪖", rarity: 1 },
      { id: "vik-2", name: "Kampfaxt", emoji: "🪓", rarity: 2 },
      { id: "vik-3", name: "Rundschild", emoji: "🛡️", rarity: 2 },
      { id: "vik-4", name: "Met-Horn", emoji: "🍻", rarity: 3 },
      { id: "vik-5", name: "Runenkompass", emoji: "🧭", rarity: 4 },
      { id: "vik-6", name: "Thors Hammer", emoji: "🔨", rarity: 5 },
    ],
  },
  {
    name: "Schätze",
    emoji: "💎",
    rewardSpins: 60,
    rewardCoins: 200_000,
    cards: [
      { id: "tre-1", name: "Goldbarren", emoji: "🪙", rarity: 1 },
      { id: "tre-2", name: "Perlenkette", emoji: "📿", rarity: 2 },
      { id: "tre-3", name: "Diamant", emoji: "💎", rarity: 3 },
      { id: "tre-4", name: "Königskrone", emoji: "👑", rarity: 4 },
      { id: "tre-5", name: "Heiliger Kelch", emoji: "🏆", rarity: 4 },
      { id: "tre-6", name: "Drachenauge", emoji: "🔮", rarity: 5 },
    ],
  },
  {
    name: "Magie",
    emoji: "✨",
    rewardSpins: 100,
    rewardCoins: 400_000,
    cards: [
      { id: "mag-1", name: "Zauberhut", emoji: "🎩", rarity: 1 },
      { id: "mag-2", name: "Krafttrank", emoji: "🧪", rarity: 2 },
      { id: "mag-3", name: "Spruchbuch", emoji: "📖", rarity: 3 },
      { id: "mag-4", name: "Zauberstab", emoji: "🪄", rarity: 4 },
      { id: "mag-5", name: "Kristallkugel", emoji: "🔮", rarity: 5 },
      { id: "mag-6", name: "Phönixfeder", emoji: "🪶", rarity: 5 },
    ],
  },
];

export const ALL_CARDS: Card[] = CARD_SETS.flatMap((s) => s.cards);

export const CHESTS: Chest[] = [
  { id: "wood", name: "Holztruhe", emoji: "🪤", cardCount: 2, baseCost: 20_000, luck: 0 },
  { id: "gold", name: "Goldtruhe", emoji: "🧰", cardCount: 4, baseCost: 40_000, luck: 1 },
  { id: "magic", name: "Magische Truhe", emoji: "🎁", cardCount: 8, baseCost: 80_000, luck: 2 },
];

// ---------- Hilfsfunktionen ----------

export function randInt(maxExclusive: number): number {
  return Math.floor(Math.random() * maxExclusive);
}

export function pick<T>(arr: T[]): T {
  return arr[randInt(arr.length)];
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)} Mio.`;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  return n.toLocaleString("de-DE");
}

/** Skalierungsfaktor: alles wird pro Dorf teurer & lukrativer. */
export function villageScale(villageIndex: number): number {
  return villageIndex + 1;
}

/** Baukosten für Objekt-Slot i (0–4) im Dorf v. */
export function itemCost(villageIndex: number, slot: number): number {
  const slotFactor = [1, 1.4, 1.9, 2.5, 3.2][slot];
  return Math.round(15_000 * slotFactor * Math.pow(villageIndex + 1, 1.6) / 1000) * 1000;
}

export function repairCost(villageIndex: number, slot: number): number {
  return Math.round((itemCost(villageIndex, slot) * REPAIR_FACTOR) / 1000) * 1000;
}

export function chestCost(chest: Chest, villageIndex: number): number {
  return chest.baseCost * villageScale(villageIndex);
}

// ---------- Slot-Logik ----------

/** Gewichtete Ergebnis-Tabelle (wie im Original serverseitig entschieden). */
const OUTCOME_WEIGHTS: { kind: SpinOutcome["kind"]; weight: number }[] = [
  { kind: "attack", weight: 9 },
  { kind: "raid", weight: 7 },
  { kind: "shield", weight: 6 },
  { kind: "energy", weight: 7 },
  { kind: "jackpot", weight: 4 },
  { kind: "coins", weight: 42 },
  { kind: "nothing", weight: 25 },
];

export function rollOutcome(villageIndex: number, bet: number): SpinOutcome {
  const total = OUTCOME_WEIGHTS.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  let kind: SpinOutcome["kind"] = "nothing";
  for (const o of OUTCOME_WEIGHTS) {
    if (r < o.weight) {
      kind = o.kind;
      break;
    }
    r -= o.weight;
  }
  const scale = villageScale(villageIndex);
  switch (kind) {
    case "attack":
      return { kind: "attack" };
    case "raid":
      return { kind: "raid" };
    case "shield":
      return { kind: "shield" };
    case "energy":
      return { kind: "energy", spins: 10 * bet };
    case "jackpot":
      return { kind: "jackpot", coins: 20_000 * scale * bet };
    case "coins": {
      // 1–3 Münzsymbole auf der Linie, jedes zahlt einzeln.
      // `count` wird mitgegeben, damit die Walzen-Anzeige exakt zur
      // Auszahlung passt (sonst würfelt die UI eine eigene Anzahl).
      const coinsShown = 1 + randInt(3);
      return { kind: "coins", coins: coinsShown * 800 * scale * bet, count: coinsShown };
    }
    default:
      return { kind: "nothing" };
  }
}

/** Erzeugt zur Auszahlung passende Walzen-Symbole. */
export function reelsForOutcome(outcome: SpinOutcome): SlotSymbol[] {
  const others: SlotSymbol[] = ["coin", "bag", "energy", "hammer", "pig", "shield"];
  const tripleOf = (s: SlotSymbol): SlotSymbol[] => [s, s, s];
  switch (outcome.kind) {
    case "attack":
      return tripleOf("hammer");
    case "raid":
      return tripleOf("pig");
    case "shield":
      return tripleOf("shield");
    case "energy":
      return tripleOf("energy");
    case "jackpot":
      return tripleOf("bag");
    case "coins":
      // Genau so viele Münzen zeigen, wie ausgezahlt werden (inkl. Dreier).
      return coinReels(outcome.count);
    default: {
      // keine Münzen, kein Dreier
      const pool = others.filter((s) => s !== "coin");
      return makeNonTriple([pick(pool), pick(pool), pick(pool)]);
    }
  }
}

function coinReels(count: number): SlotSymbol[] {
  // Genau `count` Münzsymbole (1–3), Rest zufällige Nicht-Münz-Symbole.
  const n = Math.min(3, Math.max(1, count));
  const nonCoin: SlotSymbol[] = ["bag", "energy", "hammer", "pig", "shield"];
  const reels: SlotSymbol[] = [];
  for (let i = 0; i < 3; i++) reels.push(i < n ? "coin" : pick(nonCoin));
  return shuffle(reels);
}

/** Verhindert versehentliche Dreier bei Nicht-Dreier-Ergebnissen. */
function makeNonTriple(reels: SlotSymbol[]): SlotSymbol[] {
  if (reels[0] === reels[1] && reels[1] === reels[2]) {
    const alt: SlotSymbol[] = ["coin", "bag", "energy", "hammer", "pig", "shield"];
    reels[2] = pick(alt.filter((s) => s !== reels[0]));
  }
  return reels;
}

// ---------- Angriff & Raid ----------

export interface AttackSetup {
  enemy: Enemy;
  village: Village;
  /** Hat der Gegner ein Schild? (Angriff wird geblockt) */
  blocked: boolean;
  /** Beute bei Erfolg / bei Block */
  rewardSuccess: number;
  rewardBlocked: number;
}

export function makeAttack(villageIndex: number, bet: number): AttackSetup {
  const scale = villageScale(villageIndex);
  return {
    enemy: pick(ENEMIES),
    village: pick(VILLAGES),
    blocked: Math.random() < 0.25,
    rewardSuccess: 30_000 * scale * bet,
    rewardBlocked: 5_000 * scale * bet,
  };
}

export interface RaidSetup {
  enemy: Enemy;
  /** Beute in den 4 Löchern (0 = leer), Reihenfolge = Loch-Position */
  holes: number[];
}

export function makeRaid(villageIndex: number, bet: number): RaidSetup {
  const scale = villageScale(villageIndex);
  const stash = 120_000 * scale * bet;
  const amounts = shuffle([
    Math.round(stash * 0.5),
    Math.round(stash * 0.25),
    Math.round(stash * 0.1),
    0,
  ]);
  return { enemy: pick(ENEMIES), holes: amounts };
}

// ---------- Truhen ----------

export function openChest(chest: Chest): Card[] {
  const cards: Card[] = [];
  for (let i = 0; i < chest.cardCount; i++) {
    // Seltenheit würfeln – bessere Truhen haben bessere Chancen
    const roll = Math.random() * 100;
    let rarity: number;
    if (roll < 45 - chest.luck * 10) rarity = 1;
    else if (roll < 75 - chest.luck * 8) rarity = 2;
    else if (roll < 90 - chest.luck * 4) rarity = 3;
    else if (roll < 98 - chest.luck * 2) rarity = 4;
    else rarity = 5;
    const pool = ALL_CARDS.filter((c) => c.rarity === rarity);
    cards.push(pick(pool.length ? pool : ALL_CARDS));
  }
  return cards;
}

// ---------- Spielstand ----------

export function newGame(): GameState {
  const now = Date.now();
  return {
    coins: START_COINS,
    spins: START_SPINS,
    shields: 1,
    stars: 0,
    bet: 1,
    villageIndex: 0,
    items: ["none", "none", "none", "none", "none"],
    cards: {},
    completedSets: [],
    lastRegenAt: now,
    lastDailyAt: 0,
    lastSeenAt: now,
    totalSpins: 0,
    attacksWon: 0,
    raidsWon: 0,
  };
}

/** Spin-Regeneration seit dem letzten Zeitstempel anwenden. */
export function applyRegen(state: GameState, now: number): GameState {
  const elapsed = Math.max(0, now - state.lastRegenAt);
  const earned = Math.floor(elapsed / (SPIN_REGEN_SECONDS * 1000));
  if (earned <= 0) return state;
  if (state.spins >= MAX_SPINS) {
    return { ...state, lastRegenAt: now };
  }
  const spins = Math.min(MAX_SPINS, state.spins + earned);
  return {
    ...state,
    spins,
    lastRegenAt: state.lastRegenAt + earned * SPIN_REGEN_SECONDS * 1000,
  };
}

export interface OfflineAttackNews {
  enemy: Enemy;
  blockedByShield: boolean;
  /** Beschädigter Objekt-Slot (nur wenn nicht geblockt), sonst -1 */
  damagedSlot: number;
}

/**
 * Simuliert Angriffe anderer Spieler während der Abwesenheit
 * (max. 3, ca. alle 4 h eine 40-%-Chance) – wie im Original,
 * wo das eigene Dorf offline angegriffen werden kann.
 */
export function rollOfflineAttacks(state: GameState, now: number): { state: GameState; news: OfflineAttackNews[] } {
  const hoursAway = (now - state.lastSeenAt) / 3_600_000;
  const chunks = Math.min(3, Math.floor(hoursAway / 4));
  const news: OfflineAttackNews[] = [];
  let s = { ...state, items: [...state.items] };
  for (let i = 0; i < chunks; i++) {
    if (Math.random() >= 0.4) continue;
    const enemy = pick(ENEMIES);
    if (s.shields > 0) {
      s.shields -= 1;
      news.push({ enemy, blockedByShield: true, damagedSlot: -1 });
    } else {
      const builtSlots = s.items
        .map((it, idx) => (it === "built" ? idx : -1))
        .filter((idx) => idx >= 0);
      if (builtSlots.length === 0) continue;
      const slot = pick(builtSlots);
      s.items[slot] = "damaged";
      news.push({ enemy, blockedByShield: false, damagedSlot: slot });
    }
  }
  return { state: { ...s, lastSeenAt: now }, news };
}

// ---------- Tagesbonus ----------

export interface DailyReward {
  label: string;
  emoji: string;
  spins: number;
  coins: number;
}

export function rollDailyReward(villageIndex: number): DailyReward {
  const scale = villageScale(villageIndex);
  const options: DailyReward[] = [
    { label: "10 Spins", emoji: "⚡", spins: 10, coins: 0 },
    { label: "25 Spins", emoji: "⚡", spins: 25, coins: 0 },
    { label: "50 Spins", emoji: "🌟", spins: 50, coins: 0 },
    { label: `${fmt(25_000 * scale)} Münzen`, emoji: "🪙", spins: 0, coins: 25_000 * scale },
    { label: `${fmt(50_000 * scale)} Münzen`, emoji: "💰", spins: 0, coins: 50_000 * scale },
    { label: `${fmt(100_000 * scale)} Münzen`, emoji: "💎", spins: 0, coins: 100_000 * scale },
  ];
  // Gewichtung: große Gewinne seltener
  const weights = [30, 15, 5, 25, 17, 8];
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < options.length; i++) {
    if (r < weights[i]) return options[i];
    r -= weights[i];
  }
  return options[0];
}
