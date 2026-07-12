"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyElapsed,
  attack,
  boost,
  buyEnergy,
  ENERGY_PACKS,
  formatTime,
  MAX_ENERGY,
  newGame,
  type ActionResult,
  type AetherState,
} from "@/lib/game/aether";

const SAVE_KEY = "aether_grid_save_v1";

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

  // Bau-Timer.
  useEffect(() => {
    const id = setInterval(() => {
      setState((s) =>
        s && s.timeLeft > 0
          ? { ...s, timeLeft: s.timeLeft - 1, lastSeen: Date.now() }
          : s
      );
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

  return (
    <div className="aether-grid px-4 pb-28">
      {/* HUD */}
      <div className="mx-auto mb-5 grid max-w-md grid-cols-3 gap-2 rounded-2xl border border-[var(--ag-neon)] bg-[var(--ag-panel)] p-4 text-sm">
        <Stat label="Macht" value={state.power} />
        <Stat label="Credits" value={state.credits} />
        <Stat label="Energie" value={`${state.energy}/${MAX_ENERGY}`} />
      </div>

      {/* Bau-Zone */}
      <div className="mx-auto mb-6 max-w-[250px]" style={{ perspective: 800 }}>
        <div
          className="relative h-[220px] overflow-hidden rounded-lg border-2 border-[var(--ag-neon)]"
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

      {/* Controls */}
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

        <div className="col-span-2 mt-1 rounded-2xl border border-white/10 bg-[var(--ag-panel)] p-4">
          <h4 className="mb-3 font-bold">Shop: Aether-Versorgung</h4>
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
        </div>
      </div>

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
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  danger?: boolean;
  disabled?: boolean;
}) {
  const color = danger ? "var(--ag-danger)" : "var(--ag-neon)";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded border bg-transparent px-3 py-3 text-sm font-bold uppercase tracking-wide transition hover:text-black disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[color:var(--btn-c)] ${className}`}
      style={
        {
          borderColor: color,
          color,
          ["--btn-c" as string]: color,
        } as React.CSSProperties
      }
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = color;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}
