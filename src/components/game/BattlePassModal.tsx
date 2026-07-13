"use client";

import { BATTLE_PASS_TIERS, BATTLE_PASS_XP_PER_TIER } from "@/lib/game/coinmaster";

export function BattlePassModal({ level, xp }: { level: number; xp: number }) {
  const progress = (xp % BATTLE_PASS_XP_PER_TIER) / BATTLE_PASS_XP_PER_TIER;

  return (
    <div className="py-4">
      <h3 className="mb-4 text-center text-lg font-extrabold lvl-heading">Battle Pass</h3>

      <div className="mb-4 rounded-lg bg-surface p-3">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold">Tier {level + 1} / {BATTLE_PASS_TIERS}</span>
          <span className="text-xs text-gray-400">{xp % BATTLE_PASS_XP_PER_TIER} / {BATTLE_PASS_XP_PER_TIER} XP</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-border">
          <div className="h-full transition-[width] bg-gradient-to-r from-purple-500 to-pink-500" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>

      <div className="space-y-2">
        {Array.from({ length: BATTLE_PASS_TIERS }).map((_, i) => (
          <div
            key={i}
            className={`rounded px-3 py-2 text-sm font-semibold transition ${
              i < level ? "bg-emerald-500/20 text-emerald-300" : "bg-surface text-gray-400"
            }`}
          >
            Tier {i + 1}: {(i + 1) * 1000} 🪙 {i < level && "✓"}
          </div>
        ))}
      </div>
    </div>
  );
}
