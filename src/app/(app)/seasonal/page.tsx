import { Calendar, Gift, Zap } from "lucide-react";
import { SEASONS } from "@/lib/game/coinmaster";

export default function SeasonalPage() {
  const currentSeason = SEASONS[0]; // Demo: Spring
  const progress = 45; // Demo: 45%

  return (
    <div className="space-y-6 pb-24">
      <div className="mb-6">
        <h1 className="text-3xl font-black">🌸 Jahreszeiten</h1>
        <p className="text-sm text-gray-400">Saisonale Events & Rewards</p>
      </div>

      {/* Aktuelle Season */}
      <div className="card bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/40 p-4 space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{currentSeason.emoji}</span>
          <div>
            <h3 className="font-black">{currentSeason.name}</h3>
            <p className="text-xs text-gray-400">{currentSeason.durationDays} Tage</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-400">Saisonfortschritt</span>
            <span className="font-bold">{progress}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-surface-border">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded bg-white/5 p-2">
            <span className="text-xs text-gray-400">Tage verbleibend</span>
            <p className="font-bold">{Math.round(currentSeason.durationDays * (1 - progress / 100))} T.</p>
          </div>
          <div className="rounded bg-white/5 p-2">
            <span className="text-xs text-gray-400">Nächste Season</span>
            <p className="font-bold">in ~45 T.</p>
          </div>
        </div>
      </div>

      {/* Season-Rewards */}
      <div className="space-y-3">
        <h3 className="font-bold flex items-center gap-2">
          <Gift size={18} /> Saisonale Belohnungen
        </h3>

        {[
          { name: "Blüten-Rune", emoji: "🌸", coins: 50_000, unlocked: true },
          { name: "Waldland-Skin", emoji: "🌲", coins: 100_000, unlocked: false },
          { name: "Geheime Runen-Set", emoji: "✨", coins: 250_000, unlocked: false },
        ].map((reward, i) => (
          <div
            key={i}
            className={`rounded-lg p-3 flex items-center justify-between border transition ${
              reward.unlocked
                ? "bg-emerald-500/10 border-emerald-500/40"
                : "bg-surface border-surface-border opacity-50"
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{reward.emoji}</span>
              <div>
                <p className="text-sm font-semibold">{reward.name}</p>
                <p className="text-xs text-gray-400">{reward.coins.toLocaleString()} 🪙</p>
              </div>
            </div>
            {reward.unlocked ? (
              <span className="text-xs font-bold text-emerald-400">✓ Erreicht</span>
            ) : (
              <span className="text-xs text-gray-400">Gesperrt</span>
            )}
          </div>
        ))}
      </div>

      {/* Andere Jahreszeiten */}
      <div className="space-y-3">
        <h3 className="font-bold">Kommende Jahreszeiten</h3>
        <div className="grid grid-cols-2 gap-3">
          {SEASONS.slice(1).map((season) => (
            <div key={season.id} className="card p-3 text-center opacity-60">
              <span className="text-3xl">{season.emoji}</span>
              <p className="text-xs font-semibold mt-2">{season.name}</p>
              <p className="text-[10px] text-gray-400">In ~{90 * SEASONS.indexOf(season)} Tagen</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
