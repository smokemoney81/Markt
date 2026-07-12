"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyElapsed,
  attack,
  boost,
  buildingCost,
  BUILDING_IDS,
  BUILDINGS,
  buyEnergy,
  canPrestige,
  creditsPerSec,
  energyRegenPerSec,
  ENERGY_PACKS,
  formatDuration,
  formatNum,
  formatTime,
  levelScale,
  maxEnergy,
  newGame,
  prestige,
  prestigeGainFor,
  prestigeMult,
  PRESTIGE_THRESHOLD,
  tick,
  upgradeBuilding,
  type ActionResult,
  type AetherState,
} from "@/lib/game/aether";

const SAVE_KEY = "aether_grid_save_v2";

type LogItem = { id: number; msg: string };

export default function AetherGridGame() {
  const [state, setState] = useState<AetherState | null>(null);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const logId = useRef(0);

  // Laden + Offline-Fortschritt anrechnen.
  useEffect(() => {
    let loaded: AetherState;
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      loaded = raw ? applyElapsed(JSON.parse(raw) as AetherState) : newGame();
    } catch {
      loaded = newGame();
    }
    setState(loaded);
  }, []);

  // Persistieren.
  useEffect(() => {
    if (!state) return;
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({ ...state, lastSeen: Date.now() })
      );
    } catch {
      /* Speicher nicht verfügbar – ignorieren. */
    }
  }, [state]);

  // Live-Tick: Bauzeit, Energie-Regen, Credits-Einkommen.
  useEffect(() => {
    const id = setInterval(() => {
      setState((s) => (s ? tick(s, 1) : s));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const addLog = useCallback((msg: string) => {
    const id = ++logId.current;
    setLogs((l) => [...l, { id, msg }]);
    setTimeout(() => setLogs((l) => l.filter((x) => x.id !== id)), 3000);
  }, []);

  const run = useCallback(
    (fn: (s: AetherState) => ActionResult) => {
      setState((s) => {
        if (!s) return s;
        const res = fn(s);
        addLog(res.message);
        return res.state;
      });
    },
    [addLog]
  );

  if (!state) return null;

  const building = state.timeLeft <= 0;
  const cap = maxEnergy(state);
  const energy = Math.floor(state.energy);
  const regen = energyRegenPerSec(state);
  const income = creditsPerSec(state);
  const raidMult = levelScale(state.level) * prestigeMult(state);

  return (
    <div className="aether-grid px-4 pb-28">
      {/* HUD */}
      <div className="mx-auto mb-4 grid max-w-md grid-cols-3 gap-2 rounded-2xl border border-[var(--ag-neon)] bg-[var(--ag-panel)] p-4 text-sm">
        <Stat label="Macht" value={formatNum(state.power)} />
        <Stat label="Credits" value={formatNum(state.credits)} />
        <Stat label="Energie" value={`${energy}/${cap}`} />
      </div>

      {/* Level / Prestige-Leiste */}
      <div className="mx-auto mb-5 flex max-w-md items-center justify-between gap-2 rounded-2xl border border-[var(--ag-purple)] bg-[var(--ag-panel)] px-4 py-2.5 text-sm">
        <span>
          <span className="text-gray-400">Grid-Level </span>
          <span className="font-bold text-[var(--ag-purple)]">
            {state.level}
          </span>
          <span className="text-gray-500"> · ×{raidMult.toFixed(2)} Beute</span>
        </span>
        <span className="text-right">
          <span className="text-gray-400">Kerne </span>
          <span className="font-bold text-[var(--ag-purple)]">
            {state.prestige}
          </span>
        </span>
      </div>

      {/* Bau-Zone */}
      <div className="mx-auto mb-6 max-w-[250px]" style={{ perspective: 800 }}>
        <div
          className="relative h-[200px] overflow-hidden rounded-lg border-2 border-[var(--ag-neon)]"
          style={{
            transform: "rotateX(20deg)",
            background:
              "radial-gradient(circle, rgba(0,242,255,0.12) 0%, transparent 70%)",
          }}
        >
          {!building && <div className="aether-scan" />}
        </div>
        <p className="mt-3 text-center text-sm text-[var(--ag-neon)]">
          {building ? "Konstruktion aktiv" : `Bauzeit: ${formatTime(state.timeLeft)}`}
        </p>
      </div>

      {/* Aktionen */}
      <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
        <NeonButton onClick={() => run(boost)} disabled={building}>
          Quantum-Boost (−1 Min)
        </NeonButton>
        <NeonButton onClick={() => run((s) => attack(s, "PvE"))}>
          Sektor Raid (10E)
        </NeonButton>
        <NeonButton
          className="col-span-2"
          danger
          onClick={() => run((s) => attack(s, "PvP"))}
        >
          Hacke Spieler (20E)
        </NeonButton>
      </div>

      {/* Gebäude */}
      <Section title="Konstruktionen">
        <div className="flex flex-col gap-2">
          {BUILDING_IDS.map((id) => {
            const cfg = BUILDINGS[id];
            const lvl = state.buildings[id];
            const maxed = lvl >= cfg.maxLevel;
            const cost = buildingCost(state, id);
            const affordable = state.credits >= cost;
            return (
              <div
                key={id}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3"
              >
                <span className="text-2xl">{cfg.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {cfg.label}{" "}
                    <span className="text-xs text-gray-400">Stufe {lvl}</span>
                  </p>
                  <p className="text-xs text-gray-400">{cfg.desc}</p>
                </div>
                <NeonButton
                  onClick={() => run((s) => upgradeBuilding(s, id))}
                  disabled={maxed || !affordable}
                  className="shrink-0 text-xs"
                >
                  {maxed ? "MAX" : `${formatNum(cost)} Cr`}
                </NeonButton>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-center text-xs text-gray-500">
          Regen {regen.toFixed(2)} E/s · Einkommen {income.toFixed(1)} Cr/s
        </p>
      </Section>

      {/* Shop */}
      <Section title="Shop: Aether-Versorgung">
        <div className="flex gap-3">
          {ENERGY_PACKS.map((p) => (
            <NeonButton
              key={p.amount}
              className="flex-1"
              onClick={() => run((s) => buyEnergy(s, p.amount, p.cost))}
            >
              +{p.amount}E ({p.cost} Cr)
            </NeonButton>
          ))}
        </div>
      </Section>

      {/* Prestige */}
      <Section title="Aether-Prestige">
        <p className="mb-3 text-xs text-gray-400">
          Setzt Macht, Credits & Konstruktionen zurück – jeder Kern gibt dauerhaft
          +10 % auf Beute und Einkommen. Freigeschaltet ab{" "}
          {formatNum(PRESTIGE_THRESHOLD)} Macht.
        </p>
        <NeonButton
          className="w-full"
          purple
          disabled={!canPrestige(state)}
          onClick={() => run(prestige)}
        >
          {canPrestige(state)
            ? `Prestige (+${prestigeGainFor(state)} Kern${
                prestigeGainFor(state) > 1 ? "e" : ""
              })`
            : `Noch ${formatNum(PRESTIGE_THRESHOLD - state.power)} Macht`}
        </NeonButton>
      </Section>

      {/* Statistik */}
      <Section title="Statistik">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Stat label="Beste Macht" value={formatNum(state.bestPower)} />
          <Stat label="Beste Credits" value={formatNum(state.bestCredits)} />
          <Stat label="Raids gesamt" value={formatNum(state.raids)} />
          <Stat label="Spielzeit" value={formatDuration(state.playSeconds)} />
        </div>
      </Section>

      {/* Log-Overlay */}
      <div className="pointer-events-none fixed right-4 top-4 z-40 flex flex-col gap-2">
        {logs.map((l) => (
          <div
            key={l.id}
            className="aether-log rounded border-l-4 border-[var(--ag-neon)] bg-black/80 px-4 py-2 text-sm text-[var(--ag-neon)]"
          >
            {l.msg}
          </div>
        ))}
      </div>

      <style jsx global>{`
        .aether-grid {
          --ag-neon: #00f2ff;
          --ag-purple: #9d00ff;
          --ag-danger: #ff0055;
          --ag-panel: rgba(20, 30, 45, 0.9);
        }
        .aether-scan {
          position: absolute;
          left: 0;
          width: 100%;
          height: 4px;
          background: var(--ag-neon);
          box-shadow: 0 0 15px var(--ag-neon);
          animation: aetherScan 2s linear infinite;
        }
        @keyframes aetherScan {
          0% {
            top: 0;
          }
          100% {
            top: 100%;
          }
        }
        .aether-log {
          animation: aetherSlide 0.3s ease;
        }
        @keyframes aetherSlide {
          from {
            transform: translateX(120%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto mt-4 max-w-md rounded-2xl border border-white/10 bg-[var(--ag-panel)] p-4">
      <h4 className="mb-3 font-bold">{title}</h4>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-bold text-[var(--ag-neon)]">{value}</p>
    </div>
  );
}

function NeonButton({
  children,
  onClick,
  className = "",
  danger = false,
  purple = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  danger?: boolean;
  purple?: boolean;
  disabled?: boolean;
}) {
  const color = danger
    ? "var(--ag-danger)"
    : purple
      ? "var(--ag-purple)"
      : "var(--ag-neon)";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded border bg-transparent px-3 py-3 text-sm font-bold uppercase tracking-wide transition disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      style={{ borderColor: color, color }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = color;
        e.currentTarget.style.color = "#000";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = color;
      }}
    >
      {children}
    </button>
  );
}
