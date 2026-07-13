import { Trophy, Lock } from "lucide-react";
import { ACHIEVEMENTS } from "@/lib/game/coinmaster";

export default function AchievementsPage() {
  return (
    <div className="space-y-6 pb-24">
      <div className="mb-6">
        <h1 className="text-3xl font-black">🏆 Erfolge</h1>
        <p className="text-sm text-gray-400">Meilensteine & Badges</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {ACHIEVEMENTS.map((ach, i) => {
          const unlocked = Math.random() > 0.4; // Demo: random unlock
          return (
            <div
              key={ach.id}
              className={`rounded-lg p-3 text-center border transition ${
                unlocked
                  ? "bg-emerald-500/10 border-emerald-500/40"
                  : "bg-surface border-surface-border opacity-50"
              }`}
            >
              <div className="flex justify-center mb-2">
                {unlocked ? (
                  <Trophy size={32} className="text-yellow-400" />
                ) : (
                  <Lock size={32} className="text-gray-500" />
                )}
              </div>
              <h4 className="text-xs font-bold">{ach.name}</h4>
              <p className="text-[10px] text-gray-400 mt-1">{ach.description}</p>
              {unlocked && <span className="text-[10px] text-emerald-400 mt-1">✓ Erreicht</span>}
            </div>
          );
        })}
      </div>

      <div className="card bg-blue-500/10 border border-blue-500/40 p-4">
        <p className="text-xs text-gray-400">
          🎯 <strong>Pro-Tipp:</strong> Erreiche alle 12 Erfolge und schalte exklusive Cosmetics frei!
        </p>
      </div>
    </div>
  );
}
