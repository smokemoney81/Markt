"use client";

import { useState } from "react";
import { Trophy, TrendingUp } from "lucide-react";
import { fmt } from "@/lib/game/coinmaster";

interface LeaderboardEntry {
  rank: number;
  score: number;
  user_id: string;
}

export function LeaderboardModal({
  myRank,
  entries,
  period,
  onPeriodChange,
}: {
  myRank: { rank: number | null; score: number } | null;
  entries: LeaderboardEntry[];
  period: "global" | "weekly" | "seasonal";
  onPeriodChange: (period: "global" | "weekly" | "seasonal") => void;
}) {
  return (
    <div className="py-4">
      <h3 className="mb-4 text-center text-lg font-extrabold lvl-heading flex items-center justify-center gap-2">
        <Trophy size={20} /> Rangliste
      </h3>

      <div className="mb-4 flex gap-2">
        {(["global", "weekly", "seasonal"] as const).map((p) => (
          <button
            key={p}
            onClick={() => onPeriodChange(p)}
            className={`flex-1 rounded px-2 py-1 text-xs font-semibold transition ${
              period === p ? "bg-yellow-500 text-yellow-950" : "bg-surface hover:bg-surface-light"
            }`}
          >
            {p === "global" ? "Global" : p === "weekly" ? "Diese Woche" : "Saison"}
          </button>
        ))}
      </div>

      {myRank && myRank.rank && (
        <div className="mb-4 rounded-lg bg-amber-500/20 p-3 border border-amber-500/40">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">Dein Rang</span>
            <span className="text-lg font-black text-amber-300">#{myRank.rank}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
            <span>Punktzahl</span>
            <span>{fmt(myRank.score)}</span>
          </div>
        </div>
      )}

      <div className="space-y-1 max-h-64 overflow-y-auto">
        {entries.slice(0, 20).map((entry, i) => (
          <div key={`${entry.user_id}-${entry.rank}`} className="flex items-center justify-between rounded px-2 py-1 text-sm bg-surface/50">
            <div className="flex items-center gap-2">
              <span className="w-6 text-center font-bold">
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${entry.rank}`}
              </span>
              <span className="text-xs text-gray-400">Player {entry.user_id.slice(0, 8)}</span>
            </div>
            <span className="font-semibold text-yellow-300">{fmt(entry.score)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
