import { CheckCircle2, Circle, Zap, Target } from "lucide-react";
import { WEEKLY_CHALLENGES, fmt } from "@/lib/game/coinmaster";

export default function ChallengesPage() {
  return (
    <div className="space-y-6 pb-24">
      <div className="mb-6">
        <h1 className="text-3xl font-black">🎯 Wöchentliche Aufgaben</h1>
        <p className="text-sm text-gray-400">Erreiche Ziele & verdiene Münzen</p>
      </div>

      {/* Wocheninfo */}
      <div className="card bg-blue-500/10 border-blue-500/40 p-3 text-sm">
        <p className="text-gray-300">
          Diese Woche: <span className="font-bold">Montag – Sonntag</span>
        </p>
        <p className="text-gray-400 text-xs mt-1">3 von 5 Aufgaben abgeschlossen (60%)</p>
      </div>

      {/* Challenge-Liste */}
      <div className="space-y-2">
        {WEEKLY_CHALLENGES.map((challenge, i) => {
          const completed = i < 3; // Demo: first 3 done
          const progress = completed ? 100 : Math.floor(Math.random() * 70);

          return (
            <div
              key={challenge.id}
              className={`rounded-lg p-4 border transition ${
                completed
                  ? "bg-emerald-500/10 border-emerald-500/40"
                  : "bg-surface border-surface-border"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  {completed ? (
                    <CheckCircle2 size={24} className="text-emerald-400" />
                  ) : (
                    <Circle size={24} className="text-gray-500" />
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-bold">{challenge.name}</h3>
                    <span className="text-xs font-bold text-yellow-400">+{fmt(challenge.reward)} 🪙</span>
                  </div>

                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span>Fortschritt</span>
                      <span>
                        {Math.floor((progress / 100) * challenge.target)} / {challenge.target}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-border">
                      <div
                        className={`h-full transition-[width] ${
                          completed
                            ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                            : "bg-gradient-to-r from-blue-500 to-cyan-500"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {completed && (
                    <button className="btn-sm bg-emerald-500 text-white font-semibold w-full">
                      Belohnung abholen
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tips */}
      <div className="card bg-purple-500/10 border-purple-500/40 p-4">
        <div className="flex gap-3">
          <Target size={20} className="text-purple-400 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-purple-300">Pro-Tipp</p>
            <p className="text-xs text-gray-400 mt-1">
              Vervollständige alle 5 Aufgaben für einen Bonusboost! (+1000 🪙 extra)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
