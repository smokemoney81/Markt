"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Layers,
  RotateCcw,
  ShoppingBag,
  Star,
  X,
  Zap,
} from "lucide-react";
import { Sheet } from "@/components/ui";
import {
  BET_STEPS,
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
  VILLAGES,
  type AttackSetup,
  type Card,
  type CardSet,
  type Chest,
  type DailyReward,
  type Enemy,
  type GameState,
  type OfflineAttackNews,
  type SlotSymbol,
} from "@/lib/game/coinmaster";
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
  | null;

function errMsg(e: unknown): string {
  return e instanceof GameApiError ? e.message : "Verbindungsfehler.";
}

export default function CoinMasterGame() {
  const [state, setState] = useState<GameState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [reels, setReels] = useState<SlotSymbol[]>(["coin", "energy", "bag"]);
  const [spinningReels, setSpinningReels] = useState<boolean[]>([false, false, false]);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [shop, setShop] = useState<ShopOverview | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const busy = spinningReels.some(Boolean);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stateRef = useRef<GameState | null>(null);
  stateRef.current = state;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    const to = setTimeout(() => setToast(null), 2500);
    timeouts.current.push(to);
  }, []);

  // ----- Laden vom Server (autoritativ) + Offline-Ereignisse -----
  useEffect(() => {
    const timeoutRef = timeouts.current;
    let active = true;
    api
      .fetchState()
      .then(({ state, news }) => {
        if (!active) return;
        setState(state);
        if (news.length > 0) setOverlay({ type: "offline", news });
      })
      .catch((e) => active && setLoadError(errMsg(e)));
    return () => {
      active = false;
      timeoutRef.forEach(clearTimeout);
    };
  }, []);

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

  // ----- Hintergrund-Refresh: regenerierte Spins vom Server nachladen -----
  useEffect(() => {
    const iv = setInterval(() => {
      if (pending || busy || overlay) return;
      const s = stateRef.current;
      if (s && s.spins < MAX_SPINS) {
        api.fetchState().then(({ state }) => setState(state)).catch(() => {});
      }
    }, 20_000);
    return () => clearInterval(iv);
  }, [pending, busy, overlay]);

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
        showToast(`💰 Jackpot! +${fmt(spin.outcome.coins)} Münzen`);
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
      if (res.build?.villageCompleted) {
        setOverlay({ type: "village", ...res.build.villageCompleted });
      }
    });
  }

  // ----- Truhen & Karten -----
  async function buyChest(chest: Chest) {
    await run(async () => {
      const res = await api.buyChest(chest.id);
      setState(res.state);
      setOverlay({ type: "chest", chest, cards: res.chest!.cards });
      if (res.chest?.completedSet) {
        const set = res.chest.completedSet;
        const to = setTimeout(() => setOverlay({ type: "set", set }), 2600);
        timeouts.current.push(to);
      }
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
    return (
      <div className="mx-4 mt-8 rounded-2xl border border-surface-border bg-surface-card p-5 text-center text-sm text-gray-300">
        <p className="font-semibold text-rose-300">Spiel konnte nicht geladen werden</p>
        <p className="mt-2 text-gray-400">{loadError}</p>
        <p className="mt-2 text-xs text-gray-500">
          Der Spielstand liegt jetzt serverseitig. Prüfe, ob{" "}
          <code>SUPABASE_SERVICE_ROLE_KEY</code> gesetzt und die Migration{" "}
          <code>0002_game.sql</code> ausgeführt ist.
        </p>
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

  return (
    <div className="px-4 pb-6">
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

      {/* ---------- Slot-Maschine ---------- */}
      <div className="card bg-gradient-to-b from-[#241a2e] to-surface-card">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-bold text-amber-300">
            {village.emoji} {village.name} · Dorf {state.villageIndex + 1}
          </span>
          <button
            onClick={claimDaily}
            disabled={!dailyReady || pending}
            className={`chip ${
              dailyReady
                ? "animate-pulse bg-amber-500/20 text-amber-300"
                : "bg-gray-500/10 text-gray-500"
            }`}
          >
            🎁 {dailyReady ? "Tagesbonus!" : "Bonus später"}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-2xl border-2 border-amber-500/40 bg-[#120d17] p-3">
          {reels.map((sym, i) => (
            <Reel key={i} symbol={sym} spinning={spinningReels[i]} />
          ))}
        </div>

        <div className="mt-2 min-h-[1.5rem] text-center text-sm font-semibold text-amber-300">
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
            className="btn flex-1 bg-gradient-to-b from-amber-400 to-amber-600 text-base font-extrabold text-amber-950 shadow-lg shadow-amber-900/40 disabled:opacity-40"
          >
            <Zap size={18} />
            {state.spins < state.bet ? "Keine Spins" : busy ? "…" : "DREHEN"}
          </button>
        </div>

        <p className="mt-2 text-center text-[11px] text-gray-500">
          3× 🔨 Angriff · 3× 🐷 Raid · 3× 🛡️ Schild · 3× ⚡ Spins · 3× 💰 Jackpot
        </p>
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
            const cost =
              st === "damaged"
                ? repairCost(state.villageIndex, slot)
                : itemCost(state.villageIndex, slot);
            return (
              <div key={item.name} className="card flex items-center gap-3 py-3">
                <span className={`text-3xl ${st === "damaged" ? "grayscale" : st === "none" ? "opacity-30" : ""}`}>
                  {st === "damaged" ? "💥" : item.emoji}
                </span>
                <div className="flex-1">
                  <p className="font-medium">{item.name}</p>
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
                    {st === "none" && <>Kosten: {fmt(cost)} 🪙</>}
                  </p>
                </div>
                {st !== "built" && (
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

      <p className="mt-3 text-center text-[11px] text-gray-600">
        {state.totalSpins} Spins gespielt · {state.attacksWon} Angriffe · {state.raidsWon} Raids
      </p>

      {/* ---------- Overlays ---------- */}
      {overlay?.type === "attack" && (
        <GameOverlay>
          <h3 className="text-lg font-extrabold">🔨 Angriff!</h3>
          <p className="mt-1 text-sm text-gray-300">
            Greife das Dorf von{" "}
            <span className="font-semibold text-amber-300">
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
            <span className="font-semibold text-amber-300">
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
                        ? "border-amber-500 bg-amber-500/15"
                        : "border-surface-border bg-surface opacity-60"
                      : "border-dashed border-amber-500/50 bg-surface"
                  }`}
                >
                  {shown ? (
                    amount > 0 ? (
                      <>
                        💰
                        <span className="text-sm font-bold text-amber-300">+{fmt(amount)}</span>
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
            <p className="mt-1 text-amber-300">{overlay.reward.label}</p>
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
                <span className="text-[10px] text-amber-300">{"★".repeat(c.rarity)}</span>
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
          <div className="py-4 text-center">
            <div className="text-5xl">🎉</div>
            <h3 className="mt-2 text-lg font-extrabold">{overlay.name} abgeschlossen!</h3>
            <p className="mt-1 text-sm text-gray-300">
              Belohnung: <b className="text-amber-300">+{overlay.rewardSpins} Spins</b> und{" "}
              <b className="text-amber-300">+{fmt(overlay.rewardCoins)} Münzen</b>
            </p>
            <p className="mt-2 text-sm text-gray-400">
              Weiter geht&apos;s in: {VILLAGES[state.villageIndex].emoji}{" "}
              <b>{VILLAGES[state.villageIndex].name}</b>
            </p>
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
              Belohnung: <b className="text-amber-300">+{overlay.set.rewardSpins} Spins</b> und{" "}
              <b className="text-amber-300">+{fmt(overlay.set.rewardCoins)} Münzen</b>
            </p>
            <button onClick={() => setOverlay(null)} className="btn-primary mt-4 w-full">
              Stark!
            </button>
          </div>
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
                <span className="mt-1 text-xs font-bold text-amber-300">{fmt(cost)} 🪙</span>
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
                            ? "border-amber-500/40 bg-amber-500/10"
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
                      <span className="ml-1 rounded bg-amber-500/20 px-1 text-[10px] text-amber-300">
                        einmalig
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-400">{product.description}</p>
                </div>
                <button
                  onClick={() => buyProduct(product)}
                  disabled={pending || owned}
                  className="btn shrink-0 bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-300 disabled:opacity-40"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-3xl border border-surface-border bg-surface-card p-5 shadow-2xl">
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
