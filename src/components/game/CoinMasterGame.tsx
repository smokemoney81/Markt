"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Flame,
  Info,
  Layers,
  RotateCcw,
  ShoppingBag,
  Star,
  Timer,
  Trophy,
  X,
  Zap,
  Gem,
  Users,
  TrendingUp,
} from "lucide-react";
import { Sheet } from "@/components/ui";
import { BattlePassModal } from "./BattlePassModal";
import { CosmeticsModal } from "./CosmeticsModal";
import { LeaderboardModal } from "./LeaderboardModal";
import { FriendsModal } from "./FriendsModal";
import {
  BET_STEPS,
  buildDurationSeconds,
  buildingBonusMultiplier,
  CARD_SETS,
  CHESTS,
  chestCost,
  DAILY_BONUS_HOURS,
  fmt,
  itemCost,
  MAX_SHIELDS,
  MAX_SPINS,
  reelsForOutcome,
  repairCost,
  SPIN_REGEN_SECONDS,
  streakMultiplier,
  VILLAGES,
  type AttackSetup,
  type BuildJob,
  type Card,
  type CardSet,
  type Chest,
  type DailyReward,
  type Enemy,
  type GameState,
  type OfflineAttackNews,
  type SlotSymbol,
} from "@/lib/game/coinmaster";
import { getLevelTheme, themeCssVars } from "@/lib/game/theme";
import * as api from "@/lib/game/api";
import { GameApiError } from "@/lib/game/api";
import type { ActionResponse } from "@/lib/game/server";
import type { ShopOverview, ShopProduct } from "@/lib/game/shop";

const SYMBOL_EMOJI: Record<SlotSymbol, string> = {
  coin: "🪙",
  bag: "💰",
  energy: "⚡",
  hammer: "🔨",
  pig: "🐷",
  shield: "🛡️",
};

const ALL_SYMBOLS: SlotSymbol[] = ["coin", "bag", "energy", "hammer", "pig", "shield"];

type Overlay =
  | { type: "attack"; setup: AttackSetup; smashed: number | null }
  | { type: "raid"; enemy: Enemy; holes: number[]; dug: number[]; revealed: number[] }
  | { type: "daily"; reward: DailyReward }
  | { type: "chest"; chest: Chest; cards: Card[] }
  | { type: "offline"; news: OfflineAttackNews[] }
  | { type: "village"; name: string; rewardSpins: number; rewardCoins: number }
  | { type: "set"; set: CardSet }
  | { type: "jackpot"; coins: number }
  | { type: "info"; title: string; body: React.ReactNode }
  | { type: "discount"; endsAt: number; product: string; percent: number }
  | { type: "battle-pass"; level: number; xp: number }
  | { type: "cosmetics"; selected: string }
  | { type: "leaderboard"; period: "global" | "weekly" | "seasonal" }
  | { type: "friends"; friendIds: string[] }
  | null;

type Tab = "game" | "battle-pass" | "cosmetics" | "leaderboard" | "friends";

function errMsg(e: unknown): string {
  return e instanceof GameApiError ? e.message : "Verbindungsfehler.";
}

/** Ladefehler mit Fehlercode, damit die UI passend reagieren kann (Login vs. Config vs. Retry). */
type LoadError = { code: string; message: string };

function toLoadError(e: unknown): LoadError {
  if (e instanceof GameApiError) return { code: e.code, message: e.message };
  return { code: "VERBINDUNG", message: "Verbindungsfehler." };
}

export default function CoinMasterGame() {
  const [state, setState] = useState<GameState | null>(null);
  const [loadError, setLoadError] = useState<LoadError | null>(null);
  const [pending, setPending] = useState(false);
  const [reels, setReels] = useState<SlotSymbol[]>(["coin", "energy", "bag"]);
  const [spinningReels, setSpinningReels] = useState<boolean[]>([false, false, false]);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [shop, setShop] = useState<ShopOverview | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [tab, setTab] = useState<Tab>("game");
  const busy = spinningReels.some(Boolean);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stateRef = useRef<GameState | null>(null);
  stateRef.current = state;

  // Level-Theme muss VOR den bedingten Returns (loadError/!state) berechnet
  // werden, sonst variiert die Hook-Reihenfolge zwischen Renders
  // ("Rendered more hooks than during the previous render"). state kann hier
  // noch null sein → Fallback auf Dorf 0.
  const theme = useMemo(() => getLevelTheme(state?.villageIndex ?? 0), [state?.villageIndex]);
  const themeStyle = useMemo(() => themeCssVars(theme), [theme]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    const to = setTimeout(() => setToast(null), 2500);
    timeouts.current.push(to);
  }, []);

  // ----- Laden vom Server (autoritativ) + Offline-Ereignisse -----
  const loadState = useCallback(() => {
    setLoadError(null);
    return api
      .fetchState()
      .then((res) => {
        setState(res.state);
        if (res.villageCompleted) {
          setOverlay({ type: "village", ...res.villageCompleted });
        } else if (res.news.length > 0) {
          setOverlay({ type: "offline", news: res.news });
        }
      })
      .catch((e) => setLoadError(toLoadError(e)));
  }, []);

  useEffect(() => {
    const timeoutRef = timeouts.current;
    loadState();
    return () => {
      timeoutRef.forEach(clearTimeout);
    };
  }, [loadState]);

  // ----- Rückkehr von der Stripe-Bezahlseite -----
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kauf = params.get("kauf");
    if (!kauf) return;
    window.history.replaceState(null, "", window.location.pathname);
    if (kauf === "erfolg") {
      showToast("✅ Kauf erfolgreich – Gutschrift folgt gleich …");
      // Webhook braucht einen Moment; Stand kurz danach nachladen.
      const to = setTimeout(() => {
        api.fetchState().then(({ state }) => setState(state)).catch(() => {});
      }, 2500);
      timeouts.current.push(to);
    } else if (kauf === "abbruch") {
      showToast("Kauf abgebrochen.");
    }
  }, [showToast]);

  // ----- Sekundentakt: nur Countdown-Anzeige (Regen läuft serverseitig) -----
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(iv);
  }, []);

  // ----- Rabatt-Popup nach 10 Spins (mit 30min Cooldown, client-side Marketing) -----
  useEffect(() => {
    if (!state || overlay || pending) return;
    if (state.totalSpins === 0 || state.totalSpins % 10 !== 0) return;
    const KEY = "mm_last_discount_at";
    const now = Date.now();
    const last = Number(localStorage.getItem(KEY) ?? "0");
    if (now - last < 30 * 60_000) return; // 30 min Cooldown
    localStorage.setItem(KEY, String(now));
    setOverlay({
      type: "discount",
      endsAt: now + 3 * 60_000, // 3 Min Fenster
      product: "Starter-Bundle",
      percent: 60,
    });
  }, [state?.totalSpins, overlay, pending, state]);

  // ----- Discount-Overlay schließt sich nach Countdown-Ablauf -----
  useEffect(() => {
    if (overlay?.type !== "discount") return;
    if (now >= overlay.endsAt) setOverlay(null);
  }, [overlay, now]);

  // ----- Hintergrund-Refresh: regenerierte Spins + fertige Bauten nachladen -----
  useEffect(() => {
    const iv = setInterval(() => {
      if (pending || busy || overlay) return;
      const s = stateRef.current;
      if (!s) return;
      const hasBuilds = Object.keys(s.itemBuilds).length > 0;
      if (s.spins < MAX_SPINS || hasBuilds) {
        api
          .fetchState()
          .then((res) => {
            setState(res.state);
            if (res.villageCompleted) setOverlay({ type: "village", ...res.villageCompleted });
          })
          .catch(() => {});
      }
    }, 20_000);
    return () => clearInterval(iv);
  }, [pending, busy, overlay]);

  // ----- Sofortiger Refetch, sobald ein Bau-Timer abläuft (snappy Feedback) -----
  useEffect(() => {
    if (!state) return;
    const doneAts = Object.values(state.itemBuilds).map((j) => j.doneAt);
    if (doneAts.length === 0) return;
    const nextDone = Math.min(...doneAts);
    const delay = Math.max(0, nextDone - Date.now()) + 400;
    if (delay > 60_000) return; // ferne Timer polls fangen ab
    const to = setTimeout(() => {
      if (pending || busy || overlay) return;
      api
        .fetchState()
        .then((res) => {
          setState(res.state);
          if (res.villageCompleted) setOverlay({ type: "village", ...res.villageCompleted });
        })
        .catch(() => {});
    }, delay);
    return () => clearTimeout(to);
  }, [state, pending, busy, overlay]);

  /** Führt eine Server-Aktion aus und behandelt Fehler einheitlich. */
  const run = useCallback(
    async (fn: () => Promise<void>) => {
      if (pending) return;
      setPending(true);
      try {
        await fn();
      } catch (e) {
        showToast(errMsg(e));
      } finally {
        setPending(false);
      }
    },
    [pending, showToast],
  );

  // ----- Spin -----
  async function doSpin() {
    if (!state || busy || overlay || pending || state.spins < state.bet) return;
    setSpinningReels([true, true, true]);
    let res: ActionResponse;
    try {
      res = await api.spin(state.bet);
    } catch (e) {
      setSpinningReels([false, false, false]);
      showToast(errMsg(e));
      return;
    }
    const finalReels = reelsForOutcome(res.spin!.outcome);
    [600, 950, 1300].forEach((ms, i) => {
      const to = setTimeout(() => {
        setReels((r) => {
          const next = [...r];
          next[i] = finalReels[i];
          return next;
        });
        setSpinningReels((sp) => {
          const next = [...sp];
          next[i] = false;
          return next;
        });
        if (i === 2) applySpin(res);
      }, ms);
      timeouts.current.push(to);
    });
  }

  /** Wendet das (serverseitig bereits verbuchte) Spin-Ergebnis auf die UI an. */
  function applySpin(res: ActionResponse) {
    const spin = res.spin!;
    setState(res.state);
    switch (spin.outcome.kind) {
      case "coins":
        showToast(`+${fmt(spin.outcome.coins)} Münzen`);
        break;
      case "jackpot":
        setOverlay({ type: "jackpot", coins: spin.outcome.coins });
        break;
      case "energy":
        showToast(`⚡ +${spin.outcome.spins} Spins`);
        break;
      case "shield":
        showToast(spin.coinsGained > 0 ? `🛡️ Schilde voll → +${fmt(spin.coinsGained)} Münzen` : "🛡️ +1 Schild");
        break;
      case "attack":
        if (spin.combat?.attack) setOverlay({ type: "attack", setup: spin.combat.attack, smashed: null });
        break;
      case "raid":
        if (spin.combat?.raid) {
          const { enemy, holes, dug } = spin.combat.raid;
          setOverlay({ type: "raid", enemy, holes, dug, revealed: [] });
        }
        break;
      case "nothing":
        break;
    }
  }

  // ----- Angriff (Enthüllung – Beute ist serverseitig bereits verbucht) -----
  function smash(slot: number) {
    if (overlay?.type !== "attack" || overlay.smashed !== null) return;
    setOverlay({ ...overlay, smashed: slot });
  }

  // ----- Raid (Enthüllung) -----
  function reveal(hole: number) {
    if (overlay?.type !== "raid" || !overlay.dug.includes(hole) || overlay.revealed.includes(hole)) return;
    setOverlay({ ...overlay, revealed: [...overlay.revealed, hole] });
  }

  // ----- Dorf -----
  async function buildOrRepair(slot: number) {
    await run(async () => {
      const res = await api.build(slot);
      setState(res.state);
      if (res.villageCompleted) {
        setOverlay({ type: "village", ...res.villageCompleted });
      }
    });
  }

  // ----- Truhen & Karten -----
  async function buyChest(chest: Chest) {
    await run(async () => {
      const res = await api.buyChest(chest.id);
      setState(res.state);
      setOverlay({ type: "chest", chest, cards: res.chest!.cards });
      // Mehrere gleichzeitig komplettierte Sets nacheinander einblenden.
      const sets = res.chest?.completedSets ?? [];
      sets.forEach((set, i) => {
        const to = setTimeout(() => setOverlay({ type: "set", set }), 2600 + i * 2600);
        timeouts.current.push(to);
      });
    });
  }

  // ----- Tagesbonus -----
  const dailyReady = state ? now - state.lastDailyAt >= DAILY_BONUS_HOURS * 3_600_000 : false;

  async function claimDaily() {
    if (!dailyReady) return;
    await run(async () => {
      const res = await api.claimDaily();
      setState(res.state);
      if (res.daily) setOverlay({ type: "daily", reward: res.daily });
    });
  }

  async function cycleBet() {
    if (!state || busy || pending) return;
    const idx = BET_STEPS.indexOf(state.bet);
    const next = BET_STEPS[(idx + 1) % BET_STEPS.length];
    setState({ ...state, bet: next });
    try {
      await api.setBet(next);
    } catch {
      // Nicht kritisch – der Server nimmt den Einsatz beim nächsten Spin ohnehin entgegen.
    }
  }

  async function resetGame() {
    if (!confirm("Spielstand wirklich komplett zurücksetzen?")) return;
    await run(async () => {
      const res = await api.resetGame();
      setState(res.state);
      setOverlay(null);
    });
  }

  function openRulesInfo() {
    setOverlay({
      type: "info",
      title: "Spielregeln",
      body: (
        <div className="space-y-3 text-left text-xs text-gray-300">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Slot-Symbole
            </p>
            <ul className="space-y-1">
              <li>🪙 Münzen · 💰 Jackpot · ⚡ +Spins</li>
              <li>🛡️ Schild-Bonus · 🔨 Angriff · 🐷 Raid</li>
            </ul>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Streak-Multiplikator
            </p>
            <ul className="space-y-0.5">
              <li>Tag 1–2: 1×</li>
              <li>Tag 3–6: 1,5×</li>
              <li>Tag 7–13: 2×</li>
              <li>Tag 14+: 3×</li>
            </ul>
            <p className="mt-1 text-[10px] text-gray-500">
              Streak bricht bei mehr als 48 h ohne Claim.
            </p>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              Aufstieg
            </p>
            <p>
              Baue alle 5 Objekte im aktuellen Dorf, um in die nächste Stufe (insgesamt {VILLAGES.length}) aufzusteigen.
              Höhere Dörfer geben mehr Beute und ein neues UI-Design.
            </p>
          </div>
        </div>
      ),
    });
  }

  // ----- Shop / Monetarisierung -----
  function openShop() {
    setShopOpen(true);
    api.fetchShop().then(setShop).catch((e) => showToast(errMsg(e)));
  }

  async function claimReward() {
    await run(async () => {
      const res = await api.claimReward();
      setState(res.state);
      setShop((s) => (s ? { ...s, reward: res.status } : s));
      const parts = [
        res.grant.coins ? `+${fmt(res.grant.coins)} Münzen` : null,
        res.grant.spins ? `+${res.grant.spins} Spins` : null,
      ].filter(Boolean);
      showToast(`🎬 Belohnung: ${parts.join(" · ")}`);
    });
  }

  async function buyProduct(product: ShopProduct) {
    await run(async () => {
      const res = await api.checkout(product.id);
      if ("url" in res) {
        window.location.href = res.url; // Weiterleitung zur Stripe-Bezahlseite
        return;
      }
      // Test-Modus: sofort gutgeschrieben
      setState(res.state);
      setShopOpen(false);
      showToast(`✅ ${product.label} gutgeschrieben`);
    });
  }

  if (loadError) {
    const notLoggedIn = loadError.code === "NICHT_ANGEMELDET";
    const notConfigured = loadError.code === "NICHT_KONFIGURIERT";
    return (
      <div className="mx-4 mt-8 rounded-2xl border border-surface-border bg-surface-card p-5 text-center text-sm text-gray-300">
        <p className="font-semibold text-rose-300">Spiel konnte nicht geladen werden</p>
        <p className="mt-2 text-gray-400">
          {notLoggedIn ? "Deine Sitzung ist abgelaufen." : loadError.message}
        </p>
        {notLoggedIn ? (
          <>
            <p className="mt-2 text-xs text-gray-500">
              Bitte melde dich neu an – dein Spielstand liegt serverseitig bereit.
            </p>
            <a href="/login" className="btn-primary mt-4 inline-flex">
              Neu anmelden
            </a>
          </>
        ) : notConfigured ? (
          <p className="mt-2 text-xs text-gray-500">
            Der Spielstand liegt serverseitig. Prüfe, ob{" "}
            <code>SUPABASE_SERVICE_ROLE_KEY</code> gesetzt und die Migration{" "}
            <code>0002_game.sql</code> ausgeführt ist.
          </p>
        ) : (
          <button onClick={loadState} className="btn-primary mt-4 inline-flex">
            Erneut versuchen
          </button>
        )}
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-gray-400">
        Lade Spielstand …
      </div>
    );
  }

  const village = VILLAGES[state.villageIndex];
  const builtCount = state.items.filter((i) => i === "built").length;
  const regenIn = Math.max(
    0,
    SPIN_REGEN_SECONDS - Math.floor((now - state.lastRegenAt) / 1000),
  );
  const villagePct = Math.round((builtCount / state.items.length) * 100);
  const overallPct = Math.round(
    ((state.villageIndex + builtCount / state.items.length) / VILLAGES.length) * 100,
  );
  const avgWin = state.totalSpins > 0 ? Math.round(state.coins / state.totalSpins) : 0;

  return (
    <div className="lvl-root px-4 pb-6" style={themeStyle}>
      {/* ---------- Tab-Navigation ---------- */}
      {state && (
        <div className="mb-4 flex gap-1 overflow-x-auto pb-2">
          <button
            onClick={() => setTab("game")}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              tab === "game" ? "bg-yellow-500 text-yellow-950" : "bg-surface hover:bg-surface-light"
            }`}
          >
            🎮 Spiel
          </button>
          <button
            onClick={() => setTab("battle-pass")}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition flex items-center gap-1 ${
              tab === "battle-pass" ? "bg-purple-500 text-white" : "bg-surface hover:bg-surface-light"
            }`}
          >
            <Gem size={14} /> BP
            {state.battlePassLevel > 0 && <span className="badge">{state.battlePassLevel}</span>}
          </button>
          <button
            onClick={() => setTab("cosmetics")}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              tab === "cosmetics" ? "bg-pink-500 text-white" : "bg-surface hover:bg-surface-light"
            }`}
          >
            🎨 Themes
          </button>
          <button
            onClick={() => setTab("leaderboard")}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              tab === "leaderboard" ? "bg-amber-500 text-amber-950" : "bg-surface hover:bg-surface-light"
            }`}
          >
            <TrendingUp size={14} className="inline mr-1" /> Rang
          </button>
          <button
            onClick={() => setTab("friends")}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              tab === "friends" ? "bg-blue-500 text-white" : "bg-surface hover:bg-surface-light"
            }`}
          >
            <Users size={14} className="inline mr-1" /> Friends
          </button>
        </div>
      )}

      {tab === "game" && state && (
        <>
          {/* ---------- Kopfzeile mit Ressourcen ---------- */}
      <div className="mb-4 grid grid-cols-4 gap-2">
        <StatPill emoji="🪙" label="Münzen" value={fmt(state.coins)} />
        <StatPill
          emoji="⚡"
          label={
            state.spins >= MAX_SPINS
              ? "Spins voll"
              : `+1 in ${Math.floor(regenIn / 60)}:${String(regenIn % 60).padStart(2, "0")}`
          }
          value={`${state.spins}`}
        />
        <StatPill emoji="🛡️" label="Schilde" value={`${state.shields}/${MAX_SHIELDS}`} />
        <StatPill emoji="⭐" label="Sterne" value={`${state.stars}`} />
      </div>

      {/* ---------- Fortschritt: aktuelles Dorf & Gesamt ---------- */}
      <div className="mb-3 flex items-center gap-2 rounded-2xl border border-surface-border bg-surface-card px-3 py-2">
        <Trophy size={16} className="lvl-heading shrink-0" aria-hidden />
        <div className="flex-1">
          <div className="flex items-center justify-between text-[11px] font-medium text-gray-400">
            <span>
              Dorf <span className="lvl-heading font-bold">{state.villageIndex + 1}</span>/{VILLAGES.length} · {theme.tierLabel}
            </span>
            <span>{builtCount}/{state.items.length} gebaut</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-border">
            <div className="lvl-progress-fill h-full" style={{ width: `${villagePct}%` }} />
          </div>
          <div className="mt-1 text-[10px] text-gray-500">
            Gesamt-Fortschritt: {overallPct}%
          </div>
        </div>
        {state.dailyStreak > 0 && (
          <div className="flex flex-col items-center px-1 text-[10px] leading-tight text-orange-300">
            <Flame size={16} className="streak-flame" aria-hidden />
            <span className="mt-0.5 font-bold">{state.dailyStreak} T.</span>
            <span className="text-[9px] text-orange-400/70">{streakMultiplier(state.dailyStreak)}×</span>
          </div>
        )}
      </div>

      {/* ---------- Slot-Maschine ---------- */}
      <div className="card lvl-panel">
        <div className="mb-3 flex items-center justify-between">
          <span className="lvl-heading flex items-center gap-1.5 text-sm font-bold">
            {village.emoji} {village.name} · Dorf {state.villageIndex + 1}
            <button
              onClick={openRulesInfo}
              aria-label="Regeln"
              className="rounded-full p-0.5 text-gray-500 hover:bg-surface-border hover:text-gray-300"
            >
              <Info size={13} />
            </button>
          </span>
          <button
            onClick={claimDaily}
            disabled={!dailyReady || pending}
            className={`chip ${
              dailyReady
                ? "animate-pulse bg-yellow-500/20 text-yellow-300"
                : "bg-gray-500/10 text-gray-500"
            }`}
          >
            🎁 {dailyReady ? "Tagesbonus!" : "Bonus später"}
          </button>
        </div>

        <div className="lvl-reel-frame grid grid-cols-3 gap-2 rounded-2xl border-2 p-3">
          {reels.map((sym, i) => (
            <Reel key={i} symbol={sym} spinning={spinningReels[i]} />
          ))}
        </div>

        <div className="mt-2 min-h-[1.5rem] text-center text-sm font-semibold text-yellow-300">
          {toast ?? " "}
        </div>

        <div className="mt-1 flex items-center gap-2">
          <button onClick={cycleBet} disabled={busy || pending} className="btn-ghost shrink-0">
            <ArrowLeftRight size={16} />
            Einsatz x{state.bet}
          </button>
          <button
            onClick={doSpin}
            disabled={busy || pending || state.spins < state.bet || overlay !== null}
            className="btn flex-1 bg-gradient-to-b from-yellow-400 to-yellow-600 text-base font-extrabold text-yellow-950 shadow-lg shadow-yellow-900/40 disabled:opacity-40"
          >
            <Zap size={18} />
            {state.spins < state.bet ? "Keine Spins" : busy ? "…" : "DREHEN"}
          </button>
        </div>

        <p className="mt-2 text-center text-[11px] text-gray-500">
          3× 🔨 Angriff · 3× 🐷 Raid · 3× 🛡️ Schild · 3× ⚡ Spins · 3× 💰 Jackpot
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-lg border border-surface-border bg-surface/60 p-1.5 text-center">
            <div className="font-semibold text-rose-300">🔨 Angriff</div>
            <div className="text-gray-400">
              Bis <b className="text-rose-200">{fmt(30_000 * (state.villageIndex + 1) * state.bet)}</b> 🪙
            </div>
            <div className="text-[9px] text-gray-500">25% Schild-Block</div>
          </div>
          <div className="rounded-lg border border-surface-border bg-surface/60 p-1.5 text-center">
            <div className="font-semibold text-emerald-300">🐷 Raid</div>
            <div className="text-gray-400">
              Bis <b className="text-emerald-200">{fmt(Math.round(120_000 * (state.villageIndex + 1) * state.bet * 0.85))}</b> 🪙
            </div>
            <div className="text-[9px] text-gray-500">3 von 4 Löchern</div>
          </div>
        </div>
      </div>

      {/* ---------- Dorf ---------- */}
      <section className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bold">
            {village.emoji} {village.name}
          </h2>
          <span className="text-sm text-gray-400">{builtCount}/5 gebaut</span>
        </div>
        <div className="space-y-2">
          {village.items.map((item, slot) => {
            const st = state.items[slot];
            const job = state.itemBuilds[slot];
            const cost =
              st === "damaged"
                ? repairCost(state.villageIndex, slot)
                : itemCost(state.villageIndex, slot);
            const showBuilding = job !== undefined;
            const secondsLeft = job ? Math.max(0, Math.ceil((job.doneAt - now) / 1000)) : 0;
            return (
              <div key={item.name} className="card flex items-center gap-3 py-3">
                <span
                  className={`text-3xl ${
                    showBuilding
                      ? "animate-pulse"
                      : st === "damaged"
                        ? "grayscale"
                        : st === "none"
                          ? "opacity-30"
                          : ""
                  }`}
                >
                  {showBuilding ? "🚧" : st === "damaged" ? "💥" : item.emoji}
                </span>
                <div className="flex-1">
                  <p className="font-medium">{item.name}</p>
                  {showBuilding ? (
                    <div className="mt-1">
                      <p className="mb-0.5 flex items-center gap-1 text-xs text-yellow-300">
                        <Timer size={11} />
                        {job.repair ? "Reparatur" : "Bau"} läuft · noch{" "}
                        {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
                      </p>
                      <BuildBar job={job} slot={slot} villageIndex={state.villageIndex} now={now} />
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">
                      {st === "built" && (
                        <span className="text-emerald-300">
                          <Star size={11} className="mr-0.5 inline" />
                          Gebaut
                        </span>
                      )}
                      {st === "damaged" && (
                        <span className="text-rose-300">Zerstört – Reparatur {fmt(cost)}</span>
                      )}
                      {st === "none" && <>Kosten: {fmt(cost)} 🪙 · {buildDurationSeconds(state.villageIndex, slot)}s</>}
                    </p>
                  )}
                </div>
                {!showBuilding && st !== "built" && (
                  <button
                    onClick={() => buildOrRepair(slot)}
                    disabled={state.coins < cost || pending}
                    className={`btn shrink-0 px-3 py-1.5 text-xs ${
                      st === "damaged"
                        ? "bg-rose-500/20 text-rose-300 disabled:opacity-40"
                        : "bg-emerald-500/20 text-emerald-300 disabled:opacity-40"
                    }`}
                  >
                    {st === "damaged" ? "Reparieren" : "Bauen"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------- Karten & Truhen / Shop / Reset ---------- */}
      <div className="mt-4 flex gap-2">
        <button onClick={() => setCardsOpen(true)} className="btn-ghost flex-1">
          <Layers size={16} />
          Karten
        </button>
        <button onClick={openShop} className="btn-ghost flex-1">
          <ShoppingBag size={16} />
          Shop
        </button>
        <button onClick={resetGame} disabled={pending} className="btn-ghost shrink-0 text-gray-500" aria-label="Zurücksetzen">
          <RotateCcw size={16} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[10px] text-gray-500">
        <div>
          <div className="text-xs font-bold text-gray-300">{state.totalSpins}</div>
          <div>Spins</div>
        </div>
        <div>
          <div className="text-xs font-bold text-gray-300">{state.attacksWon}</div>
          <div>Angriffe</div>
        </div>
        <div>
          <div className="text-xs font-bold text-gray-300">{state.raidsWon}</div>
          <div>Raids</div>
        </div>
        <div>
          <div className="text-xs font-bold text-gray-300">{fmt(avgWin)}</div>
          <div>Ø/Spin</div>
        </div>
      </div>

      {/* ---------- Overlays ---------- */}
      {overlay?.type === "attack" && (
        <GameOverlay>
          <h3 className="text-lg font-extrabold">🔨 Angriff!</h3>
          <p className="mt-1 text-sm text-gray-300">
            Greife das Dorf von{" "}
            <span className="font-semibold text-yellow-300">
              {overlay.setup.enemy.emoji} {overlay.setup.enemy.name}
            </span>{" "}
            an – tippe ein Gebäude an!
          </p>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {overlay.setup.village.items.map((it, i) => (
              <button
                key={i}
                onClick={() => smash(i)}
                disabled={overlay.smashed !== null}
                className={`flex aspect-square items-center justify-center rounded-xl border text-3xl transition active:scale-90 ${
                  overlay.smashed === i
                    ? "border-rose-500 bg-rose-500/20"
                    : "border-surface-border bg-surface"
                }`}
              >
                {overlay.smashed === i ? (overlay.setup.blocked ? "🛡️" : "💥") : it.emoji}
              </button>
            ))}
          </div>
          {overlay.smashed !== null && (
            <div className="mt-4 text-center">
              {overlay.setup.blocked ? (
                <p className="font-semibold text-sky-300">
                  Geblockt! {overlay.setup.enemy.name} hatte ein Schild.
                  <br />
                  Trostpreis: {fmt(overlay.setup.rewardBlocked)} 🪙
                </p>
              ) : (
                <p className="font-semibold text-emerald-300">
                  Volltreffer! Beute: {fmt(overlay.setup.rewardSuccess)} 🪙
                </p>
              )}
              <button onClick={() => setOverlay(null)} className="btn-primary mt-3 w-full">
                Einsammeln
              </button>
            </div>
          )}
        </GameOverlay>
      )}

      {overlay?.type === "raid" && (
        <GameOverlay>
          <h3 className="text-lg font-extrabold">🐷 Raid!</h3>
          <p className="mt-1 text-sm text-gray-300">
            Du überfällst{" "}
            <span className="font-semibold text-yellow-300">
              {overlay.enemy.emoji} {overlay.enemy.name}
            </span>
            ! Grabe die <b>3 Verstecke</b> aus.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {overlay.dug.map((holeIndex) => {
              const shown = overlay.revealed.includes(holeIndex);
              const amount = overlay.holes[holeIndex];
              return (
                <button
                  key={holeIndex}
                  onClick={() => reveal(holeIndex)}
                  disabled={shown}
                  className={`flex h-20 flex-col items-center justify-center rounded-xl border text-2xl transition active:scale-95 ${
                    shown
                      ? amount > 0
                        ? "border-yellow-500 bg-yellow-500/15"
                        : "border-surface-border bg-surface opacity-60"
                      : "border-dashed border-yellow-500/50 bg-surface"
                  }`}
                >
                  {shown ? (
                    amount > 0 ? (
                      <>
                        💰
                        <span className="text-sm font-bold text-yellow-300">+{fmt(amount)}</span>
                      </>
                    ) : (
                      <>
                        🕳️
                        <span className="text-xs text-gray-500">Leer</span>
                      </>
                    )
                  ) : (
                    "❌"
                  )}
                </button>
              );
            })}
          </div>
          {overlay.revealed.length >= overlay.dug.length && (
            <button onClick={() => setOverlay(null)} className="btn-primary mt-4 w-full">
              Beute einsammeln (
              {fmt(overlay.dug.reduce((s, h) => s + overlay.holes[h], 0))} 🪙)
            </button>
          )}
        </GameOverlay>
      )}

      {overlay?.type === "daily" && (
        <GameOverlay onClose={() => setOverlay(null)}>
          <div className="py-4 text-center">
            <div className="text-5xl">{overlay.reward.emoji}</div>
            <h3 className="mt-2 text-lg font-extrabold">Tagesbonus!</h3>
            <p className="mt-1 text-yellow-300">{overlay.reward.label}</p>
            <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-300">
              <Flame size={12} className="streak-flame" />
              Streak: Tag {overlay.reward.streak}
              {overlay.reward.multiplier > 1 && (
                <span className="ml-1 rounded bg-orange-500/30 px-1.5 py-0.5 text-[10px] font-bold">
                  {overlay.reward.multiplier}×
                </span>
              )}
            </div>
            <button onClick={() => setOverlay(null)} className="btn-primary mt-4 w-full">
              Super!
            </button>
          </div>
        </GameOverlay>
      )}

      {overlay?.type === "chest" && (
        <GameOverlay>
          <h3 className="text-center text-lg font-extrabold">
            {overlay.chest.emoji} {overlay.chest.name} geöffnet!
          </h3>
          <div className="mt-4 grid grid-cols-4 gap-2">
            {overlay.cards.map((c, i) => (
              <div
                key={i}
                className="flex flex-col items-center rounded-xl border border-surface-border bg-surface p-2"
              >
                <span className="text-2xl">{c.emoji}</span>
                <span className="mt-1 w-full truncate text-center text-[10px] text-gray-300">
                  {c.name}
                </span>
                <span className="text-[10px] text-yellow-300">{"★".repeat(c.rarity)}</span>
              </div>
            ))}
          </div>
          <button onClick={() => setOverlay(null)} className="btn-primary mt-4 w-full">
            Weiter
          </button>
        </GameOverlay>
      )}

      {overlay?.type === "offline" && (
        <GameOverlay>
          <h3 className="text-lg font-extrabold">Während du weg warst …</h3>
          <div className="mt-3 space-y-2">
            {overlay.news.map((n, i) => (
              <div key={i} className="card flex items-center gap-3 py-3">
                <span className="text-2xl">{n.enemy.emoji}</span>
                <p className="text-sm">
                  <b>{n.enemy.name}</b> hat dich angegriffen –{" "}
                  {n.blockedByShield ? (
                    <span className="text-sky-300">dein Schild hat gehalten! 🛡️</span>
                  ) : (
                    <span className="text-rose-300">
                      {village.items[n.damagedSlot]?.name ?? "ein Gebäude"} wurde zerstört! 💥
                    </span>
                  )}
                </p>
              </div>
            ))}
          </div>
          <button onClick={() => setOverlay(null)} className="btn-primary mt-4 w-full">
            Verstanden
          </button>
        </GameOverlay>
      )}

      {overlay?.type === "village" && (
        <GameOverlay>
          <Confetti count={32} />
          <div className="relative py-4 text-center">
            <div className="trophy-spin text-6xl">🏆</div>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
              Dorf abgeschlossen
            </p>
            <h3 className="mt-1 text-xl font-extrabold jackpot-bounce">{overlay.name}</h3>
            <div className="mt-3 flex items-center justify-center gap-3 text-sm">
              <span className="rounded-full bg-yellow-500/20 px-3 py-1 font-bold text-yellow-300">
                +{overlay.rewardSpins} ⚡
              </span>
              <span className="rounded-full bg-yellow-500/20 px-3 py-1 font-bold text-yellow-300">
                +{fmt(overlay.rewardCoins)} 🪙
              </span>
            </div>
            <div className="mt-4 rounded-2xl border border-surface-border bg-surface p-3">
              <p className="text-[11px] uppercase tracking-widest text-gray-400">Neue Stufe</p>
              <p className="lvl-heading mt-1 text-lg font-extrabold">
                {VILLAGES[state.villageIndex].emoji} {VILLAGES[state.villageIndex].name}
              </p>
              <p className="lvl-accent text-xs">{theme.tierLabel} · Dorf {state.villageIndex + 1}/{VILLAGES.length}</p>
            </div>
            <button onClick={() => setOverlay(null)} className="btn-primary mt-4 w-full">
              Auf zum nächsten Dorf!
            </button>
          </div>
        </GameOverlay>
      )}

      {overlay?.type === "set" && (
        <GameOverlay>
          <div className="py-4 text-center">
            <div className="text-5xl">{overlay.set.emoji}</div>
            <h3 className="mt-2 text-lg font-extrabold">
              Set „{overlay.set.name}“ komplett!
            </h3>
            <p className="mt-1 text-sm text-gray-300">
              Belohnung: <b className="text-yellow-300">+{overlay.set.rewardSpins} Spins</b> und{" "}
              <b className="text-yellow-300">+{fmt(overlay.set.rewardCoins)} Münzen</b>
            </p>
            <button onClick={() => setOverlay(null)} className="btn-primary mt-4 w-full">
              Stark!
            </button>
          </div>
        </GameOverlay>
      )}

      {overlay?.type === "discount" && (() => {
        const secondsLeft = Math.max(0, Math.ceil((overlay.endsAt - now) / 1000));
        const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
        const ss = String(secondsLeft % 60).padStart(2, "0");
        return (
          <GameOverlay onClose={() => setOverlay(null)}>
            <div className="py-2 text-center">
              <div className="text-5xl">🔥</div>
              <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-rose-300">
                Kurzzeit-Angebot
              </p>
              <h3 className="mt-1 text-2xl font-extrabold text-yellow-300">
                −{overlay.percent}% auf {overlay.product}
              </h3>
              <div className="countdown-pulse mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full bg-rose-500/20 px-3 py-1 text-sm font-bold text-rose-200">
                <Timer size={14} /> {mm}:{ss}
              </div>
              <p className="mt-3 text-[11px] text-gray-500">
                Nur ein Reminder – Kauf läuft weiterhin regulär über den Shop.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setOverlay(null)}
                  className="btn-ghost flex-1"
                >
                  Später
                </button>
                <button
                  onClick={() => {
                    setOverlay(null);
                    openShop();
                  }}
                  className="btn flex-1 bg-gradient-to-r from-rose-500 to-yellow-500 font-bold text-white"
                >
                  Zum Shop
                </button>
              </div>
            </div>
          </GameOverlay>
        );
      })()}

      {overlay?.type === "info" && (
        <GameOverlay onClose={() => setOverlay(null)}>
          <div className="py-2">
            <h3 className="lvl-heading mb-3 text-center text-lg font-extrabold">
              {overlay.title}
            </h3>
            {overlay.body}
            <button onClick={() => setOverlay(null)} className="btn-primary mt-4 w-full">
              Verstanden
            </button>
          </div>
        </GameOverlay>
      )}

      {overlay?.type === "jackpot" && (
        <GameOverlay>
          <Confetti />
          <div className="relative py-4 text-center">
            <div className="jackpot-bounce text-6xl">💰</div>
            <h3 className="mt-2 text-2xl font-extrabold uppercase tracking-wider lvl-heading">
              Jackpot!
            </h3>
            <p className="mt-2 text-3xl font-black text-yellow-300 jackpot-bounce">
              +{fmt(overlay.coins)} 🪙
            </p>
            <p className="mt-2 text-xs text-gray-400">Volle Kanne! Alle drei Beutel voll!</p>
            <button
              onClick={() => setOverlay(null)}
              className="btn mt-4 w-full bg-gradient-to-r from-yellow-400 to-yellow-600 font-extrabold text-yellow-950"
            >
              Kassieren
            </button>
          </div>
        </GameOverlay>
      )}

      {overlay?.type === "battle-pass" && (
        <GameOverlay onClose={() => setOverlay(null)}>
          <BattlePassModal level={overlay.level} xp={overlay.xp} />
          <button onClick={() => setOverlay(null)} className="btn-primary mt-4 w-full">
            Schließen
          </button>
        </GameOverlay>
      )}

      {overlay?.type === "cosmetics" && (
        <GameOverlay onClose={() => setOverlay(null)}>
          <CosmeticsModal
            selected={overlay.selected}
            stars={state?.stars ?? 0}
            onSelect={async (theme) => {
              await api.selectTheme(theme as "default" | "neon" | "cyber" | "mystic");
              setOverlay(null);
            }}
          />
          <button onClick={() => setOverlay(null)} className="btn-primary mt-4 w-full">
            Schließen
          </button>
        </GameOverlay>
      )}

      {overlay?.type === "leaderboard" && (
        <GameOverlay onClose={() => setOverlay(null)}>
          <LeaderboardModal
            myRank={null}
            entries={[]}
            period={overlay.period}
            onPeriodChange={(period) => setOverlay({ type: "leaderboard", period })}
          />
          <button onClick={() => setOverlay(null)} className="btn-primary mt-4 w-full">
            Schließen
          </button>
        </GameOverlay>
      )}

      {overlay?.type === "friends" && (
        <GameOverlay onClose={() => setOverlay(null)}>
          <FriendsModal
            friendIds={overlay.friendIds}
            onAddFriend={async (fid) => {
              await api.addFriend(fid);
            }}
            onRemoveFriend={async (fid) => {
              await api.removeFriend(fid);
            }}
            onSendGift={async (fid, coins, spins) => {
              await api.sendGift(fid, coins, spins);
            }}
          />
          <button onClick={() => setOverlay(null)} className="btn-primary mt-4 w-full">
            Schließen
          </button>
        </GameOverlay>
      )}

      {/* ---------- Karten-Sheet ---------- */}
      <Sheet open={cardsOpen} onClose={() => setCardsOpen(false)} title="Karten & Truhen">
        <div className="mb-4 grid grid-cols-3 gap-2">
          {CHESTS.map((chest) => {
            const cost = chestCost(chest, state.villageIndex);
            return (
              <button
                key={chest.id}
                onClick={() => {
                  setCardsOpen(false);
                  buyChest(chest);
                }}
                disabled={state.coins < cost || pending}
                className="card flex flex-col items-center py-3 transition active:scale-95 disabled:opacity-40"
              >
                <span className="text-3xl">{chest.emoji}</span>
                <span className="mt-1 text-xs font-semibold">{chest.name}</span>
                <span className="text-[10px] text-gray-400">{chest.cardCount} Karten</span>
                <span className="mt-1 text-xs font-bold text-yellow-300">{fmt(cost)} 🪙</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          {CARD_SETS.map((set) => {
            const owned = set.cards.filter((c) => (state.cards[c.id] ?? 0) > 0).length;
            const done = state.completedSets.includes(set.name);
            return (
              <div key={set.name}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-semibold">
                    {set.emoji} {set.name}{" "}
                    {done && <span className="text-emerald-300">✓</span>}
                  </span>
                  <span className="text-gray-400">
                    {owned}/{set.cards.length} · +{set.rewardSpins} ⚡
                  </span>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {set.cards.map((c) => {
                    const count = state.cards[c.id] ?? 0;
                    return (
                      <div
                        key={c.id}
                        className={`relative flex aspect-[3/4] flex-col items-center justify-center rounded-lg border text-xl ${
                          count > 0
                            ? "border-yellow-500/40 bg-yellow-500/10"
                            : "border-surface-border bg-surface opacity-40"
                        }`}
                        title={`${c.name} (${"★".repeat(c.rarity)})`}
                      >
                        {count > 0 ? c.emoji : "❓"}
                        {count > 1 && (
                          <span className="absolute -right-1 -top-1 rounded-full bg-brand px-1 text-[9px] font-bold">
                            {count}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Sheet>

      {/* ---------- Shop-Sheet ---------- */}
      <Sheet open={shopOpen} onClose={() => setShopOpen(false)} title="Shop">
        {/* Rewarded Loop (gedeckelte Gratis-Belohnung) */}
        <div className="card mb-4 flex items-center gap-3 py-3">
          <span className="text-3xl">🎬</span>
          <div className="flex-1">
            <p className="font-semibold">Gratis-Belohnung</p>
            <p className="text-xs text-gray-400">
              {shop
                ? `+${fmt(10_000)} Münzen & +2 Spins · ${shop.reward.remaining}/${shop.reward.cap} heute übrig`
                : "…"}
            </p>
          </div>
          <button
            onClick={claimReward}
            disabled={pending || !shop || shop.reward.remaining <= 0}
            className="btn shrink-0 bg-emerald-500/20 px-3 py-1.5 text-xs text-emerald-300 disabled:opacity-40"
          >
            {shop && shop.reward.remaining <= 0 ? "Morgen wieder" : "Abholen"}
          </button>
        </div>

        {/* Kauf-Produkte */}
        <div className="space-y-2">
          {(shop?.products ?? []).map((product) => {
            const owned = shop?.ownedOnce.includes(product.id) ?? false;
            return (
              <div key={product.id} className="card flex items-center gap-3 py-3">
                <div className="flex-1">
                  <p className="font-medium">
                    {product.label}
                    {product.once && (
                      <span className="ml-1 rounded bg-yellow-500/20 px-1 text-[10px] text-yellow-300">
                        einmalig
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">{product.description}</p>
                </div>
                <button
                  onClick={() => buyProduct(product)}
                  disabled={pending || owned}
                  className="btn shrink-0 bg-yellow-500/20 px-3 py-1.5 text-xs font-bold text-yellow-300 disabled:opacity-40"
                >
                  {owned ? "Gekauft" : `${(product.priceCents / 100).toFixed(2).replace(".", ",")} €`}
                </button>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-center text-[11px] text-gray-500">
          Käufe werden erst mit angebundenem Zahlungsanbieter aktiv.
        </p>
      </Sheet>
        </>
      )}

      {tab === "battle-pass" && state && (
        <div className="card p-4">
          <BattlePassModal level={state.battlePassLevel} xp={state.battlePassXp} />
        </div>
      )}

      {tab === "cosmetics" && state && (
        <div className="card p-4">
          <CosmeticsModal
            selected={state.selectedTheme}
            stars={state.stars}
            onSelect={async (theme) => {
              await api.selectTheme(theme as "default" | "neon" | "cyber" | "mystic");
              // Refresh state
              const fresh = await api.fetchState();
              setState(fresh.state);
            }}
          />
        </div>
      )}

      {tab === "leaderboard" && state && (
        <div className="card p-4">
          <LeaderboardModal
            myRank={null}
            entries={[]}
            period="global"
            onPeriodChange={() => {}}
          />
        </div>
      )}

      {tab === "friends" && state && (
        <div className="card p-4">
          <FriendsModal
            friendIds={state.friendIds}
            onAddFriend={async (fid) => {
              await api.addFriend(fid);
              const fresh = await api.fetchState();
              setState(fresh.state);
            }}
            onRemoveFriend={async (fid) => {
              await api.removeFriend(fid);
              const fresh = await api.fetchState();
              setState(fresh.state);
            }}
            onSendGift={async (fid, coins, spins) => {
              await api.sendGift(fid, coins, spins);
              const fresh = await api.fetchState();
              setState(fresh.state);
            }}
          />
        </div>
      )}
    </div>
  );
}

// ---------- Bausteine ----------

function StatPill({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card px-2 py-1.5 text-center">
      <div className="text-sm font-extrabold">
        {emoji} {value}
      </div>
      <div className="text-[9px] text-gray-500">{label}</div>
    </div>
  );
}

function Reel({ symbol, spinning }: { symbol: SlotSymbol; spinning: boolean }) {
  const [flicker, setFlicker] = useState(symbol);
  useEffect(() => {
    if (!spinning) return;
    const iv = setInterval(() => {
      setFlicker(ALL_SYMBOLS[Math.floor(Math.random() * ALL_SYMBOLS.length)]);
    }, 70);
    return () => clearInterval(iv);
  }, [spinning]);
  return (
    <div
      className={`flex aspect-square items-center justify-center rounded-xl bg-gradient-to-b from-[#2a2033] to-[#1a1320] text-5xl ${
        spinning ? "blur-[2px]" : ""
      }`}
    >
      {spinning ? SYMBOL_EMOJI[flicker] : SYMBOL_EMOJI[symbol]}
    </div>
  );
}

function GameOverlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div className="overlay-backdrop-in fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="overlay-in relative w-full max-w-sm overflow-hidden rounded-3xl border border-surface-border bg-surface-card p-5 shadow-2xl">
        {onClose && (
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="rounded-full p-1 text-gray-400 hover:bg-surface-border"
              aria-label="Schließen"
            >
              <X size={18} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

function BuildBar({
  job,
  slot,
  villageIndex,
  now,
}: {
  job: BuildJob;
  slot: number;
  villageIndex: number;
  now: number;
}) {
  const durationSec = buildDurationSeconds(villageIndex, slot, job.repair);
  const totalMs = durationSec * 1000;
  const doneMs = Math.max(0, job.doneAt - now);
  const pct = Math.max(0, Math.min(100, ((totalMs - doneMs) / totalMs) * 100));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-surface-border">
      <div className="build-stripes h-full transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
}

const CONFETTI_EMOJIS = ["🎉", "✨", "💰", "🪙", "🌟", "💎"];

/**
 * Leichtgewichtiges Confetti: deterministisch generierte Emojis, die per
 * CSS-Keyframe (`confettiFall`) über den Popup-Container regnen. Kein
 * Framer Motion, keine Canvas – nur pointer-events:none-Overlay.
 */
function Confetti({ count = 24 }: { count?: number }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => {
        const dx = Math.round((Math.random() - 0.5) * 220);
        const rot = Math.round((Math.random() - 0.5) * 720);
        const delay = Math.round(Math.random() * 400);
        const duration = 1800 + Math.round(Math.random() * 900);
        const left = Math.round(Math.random() * 100);
        const emoji = CONFETTI_EMOJIS[i % CONFETTI_EMOJIS.length];
        return { dx, rot, delay, duration, left, emoji };
      }),
    [count],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={
            {
              left: `${p.left}%`,
              animationDelay: `${p.delay}ms`,
              "--cx": `${p.dx}px`,
              "--cr": `${p.rot}deg`,
              "--cd": `${p.duration}ms`,
            } as React.CSSProperties
          }
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}
