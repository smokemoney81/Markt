/**
 * Neues Single-Page-Layout für Münz-Meister.
 * Zeigt alles auf einer Seite: Münz-Display (groß), Gebäude-Grid, Spins.
 * Kein Scrollen zwischen Seiten.
 */

import { useCallback, useMemo } from "react";
import { Star, TrendingUp, Zap } from "lucide-react";
import {
  buildDurationSeconds,
  buildingBonusMultiplier,
  fmt,
  itemCost,
  VILLAGES,
  type GameState,
} from "@/lib/game/coinmaster";
import { getLevelTheme, themeCssVars } from "@/lib/game/theme";

interface GameLayoutProps {
  state: GameState;
  now: number;
  onBuild: (slot: number) => void;
  pending: boolean;
  children?: React.ReactNode;
}

export default function GameLayout({ state, now, onBuild, pending, children }: GameLayoutProps) {
  const theme = useMemo(() => getLevelTheme(state.villageIndex), [state.villageIndex]);
  const themeStyle = useMemo(() => themeCssVars(theme), [theme]);
  const village = VILLAGES[state.villageIndex];

  const buildProgress = useCallback(
    (slot: number) => {
      const job = state.itemBuilds[slot];
      if (!job) return null;
      const elapsed = Math.max(0, job.doneAt - now);
      return Math.max(0, Math.min(100, 100 - (elapsed / (job.doneAt - (job.doneAt - buildDurationSeconds(state.villageIndex, slot, job.repair) * 1000))) * 100));
    },
    [state, now],
  );

  return (
    <div
      className="fixed inset-0 overflow-hidden flex flex-col bg-black text-white"
      style={themeStyle as React.CSSProperties}
    >
      {/* Header: Große Münz-Anzeige */}
      <div className="flex-none px-4 py-3 text-center border-b border-zinc-700">
        <div className="text-sm opacity-70 mb-1">Münzen</div>
        <div className="text-5xl font-bold mb-3 animate-pulse">{fmt(state.coins)}</div>
        <div className="flex justify-center gap-6 text-sm">
          <div className="flex items-center gap-1">
            <Zap className="w-4 h-4" /> {state.spins}/{50}
          </div>
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4" /> {state.stars}
          </div>
          <div className="text-xs opacity-50">{village.name} {village.emoji}</div>
        </div>
      </div>

      {/* Main: Gebäude-Grid + Spins */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Gebäude (5er Grid) */}
        <div className="grid grid-cols-5 gap-3">
          {state.items.map((itemState, slot) => {
            const level = state.itemLevels[slot] ?? (itemState === "built" ? 1 : 0);
            const item = village.items[slot];
            const isBuilt = itemState === "built";
            const canBuild = itemState === "none" && !state.itemBuilds[slot];
            const nextLevel = Math.min(50, level + 1);
            const nextCost = isBuilt ? itemCost(state.villageIndex, slot, level) : 0;
            const bonus = buildingBonusMultiplier(level);
            const progress = buildProgress(slot);
            const isBuilding = progress !== null;

            return (
              <div
                key={slot}
                className="aspect-square flex flex-col items-center justify-center rounded-lg bg-zinc-900 border-2 border-zinc-700 relative cursor-pointer hover:border-brand-400 transition-all overflow-hidden"
                onClick={() => canBuild && onBuild(slot)}
              >
                {/* Gebäude-Icon */}
                {isBuilt && (
                  <>
                    <div className="text-3xl mb-1">{item.emoji}</div>
                    <div className="text-xs font-bold text-center px-1">{item.name}</div>
                    <div className="text-xs text-brand-400 mt-1">Lv. {level}/{nextLevel}</div>
                    {bonus > 1 && (
                      <div className="text-xs text-green-400 flex items-center gap-0.5 mt-0.5">
                        <TrendingUp className="w-3 h-3" />
                        +{Math.round((bonus - 1) * 100)}%
                      </div>
                    )}
                  </>
                )}

                {/* Bau-Timer */}
                {isBuilding && (
                  <div className="text-center">
                    <div className="text-xs opacity-70 mb-1">Im Bau</div>
                    <div className="w-12 h-12 rounded-full border-4 border-zinc-700 border-t-brand-400 animate-spin" />
                    <div className="text-xs mt-1 opacity-70">{Math.ceil(progress ?? 0)}%</div>
                  </div>
                )}

                {/* "Bauen" Button */}
                {canBuild && !pending && (
                  <button className="text-xs bg-brand-500 hover:bg-brand-600 px-2 py-1 rounded text-black font-bold transition-colors">
                    Bauen {nextCost > 0 && `(${fmt(nextCost)})`}
                  </button>
                )}

                {/* Empty Slot */}
                {!isBuilt && !isBuilding && (
                  <div className="text-2xl opacity-30">?</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Spins-Übersicht */}
        <div className="text-sm opacity-70 text-center">
          {state.spins < 50 ? `Regeneriert alle 3 Minuten` : "Spins maxed"}
        </div>
      </div>

      {/* Footer/Overlay-Bereich */}
      <div className="flex-none">{children}</div>
    </div>
  );
}
