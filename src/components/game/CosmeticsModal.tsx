"use client";

import { COSMETIC_THEMES } from "@/lib/game/coinmaster";
import { Lock, Palette } from "lucide-react";

export function CosmeticsModal({
  selected,
  stars,
  onSelect,
}: {
  selected: string;
  stars: number;
  onSelect: (theme: string) => Promise<void>;
}) {
  return (
    <div className="py-4">
      <h3 className="mb-4 text-center text-lg font-extrabold lvl-heading">🎨 Themes</h3>

      <div className="space-y-2">
        {Object.entries(COSMETIC_THEMES).map(([id, theme]) => {
          const unlocked = stars >= theme.unlock;
          const isSelected = selected === id;

          return (
            <button
              key={id}
              onClick={() => unlocked && onSelect(id)}
              disabled={!unlocked}
              className={`w-full rounded-lg px-4 py-3 font-semibold transition flex items-center justify-between ${
                isSelected
                  ? "bg-gradient-to-r from-yellow-400 to-yellow-600 text-yellow-950 ring-2 ring-yellow-300"
                  : unlocked
                    ? "bg-surface hover:bg-surface-light active:scale-95"
                    : "bg-surface/50 opacity-50 cursor-not-allowed"
              }`}
            >
              <div className="flex items-center gap-2">
                <Palette size={18} />
                <span>{theme.name}</span>
                {isSelected && <span>✓</span>}
              </div>
              {!unlocked && (
                <div className="flex items-center gap-1 text-xs">
                  <Lock size={14} />
                  {theme.unlock} ⭐
                </div>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-gray-500 text-center">Du hast {stars} / 2000 ⭐</p>
    </div>
  );
}
