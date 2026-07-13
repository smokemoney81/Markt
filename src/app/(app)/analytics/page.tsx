import { TrendingUp, Zap, Coins, Target } from "lucide-react";
import { fmt } from "@/lib/game/coinmaster";

export default function AnalyticsPage() {
  // Demo-Daten
  const stats = {
    totalSpins: 5_247,
    totalCoins: 2_450_000,
    attacksWon: 142,
    raidsWon: 58,
    avgCoinsPerDay: 125_000,
    avgSpinsPerDay: 85,
    winRate: 68,
  };

  return (
    <div className="space-y-6 pb-24">
      <div className="mb-6">
        <h1 className="text-3xl font-black">📊 Statistik</h1>
        <p className="text-sm text-gray-400">Deine Spielerkarriere</p>
      </div>

      {/* KPI-Karten */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card bg-gradient-to-br from-yellow-500/10 to-amber-500/10 border-yellow-500/40 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Coins size={18} className="text-yellow-400" />
            <span className="text-xs text-gray-400">Gesamt Münzen</span>
          </div>
          <p className="text-lg font-black">{fmt(stats.totalCoins)}</p>
          <p className="text-xs text-gray-400 mt-1">Ø {fmt(stats.avgCoinsPerDay)}/Tag</p>
        </div>

        <div className="card bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/40 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={18} className="text-blue-400" />
            <span className="text-xs text-gray-400">Gesamt Spins</span>
          </div>
          <p className="text-lg font-black">{fmt(stats.totalSpins)}</p>
          <p className="text-xs text-gray-400 mt-1">Ø {stats.avgSpinsPerDay}/Tag</p>
        </div>

        <div className="card bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/40 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target size={18} className="text-emerald-400" />
            <span className="text-xs text-gray-400">Kämpfe gewonnen</span>
          </div>
          <p className="text-lg font-black">{stats.attacksWon + stats.raidsWon}</p>
          <p className="text-xs text-gray-400 mt-1">{stats.winRate}% Erfolgsquote</p>
        </div>

        <div className="card bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/40 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={18} className="text-purple-400" />
            <span className="text-xs text-gray-400">Level erreicht</span>
          </div>
          <p className="text-lg font-black">Dorf 7/10</p>
          <p className="text-xs text-gray-400 mt-1">70% Fortschritt</p>
        </div>
      </div>

      {/* Detaillierte Stats */}
      <div className="card p-4 space-y-3">
        <h3 className="font-bold mb-3">Detaillierte Statistik</h3>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Spins gesamt</span>
          <span className="font-semibold">{fmt(stats.totalSpins)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Angriffe gewonnen</span>
          <span className="font-semibold">{stats.attacksWon}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Raids gewonnen</span>
          <span className="font-semibold">{stats.raidsWon}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Erfolgsquote</span>
          <span className="font-semibold text-emerald-400">{stats.winRate}%</span>
        </div>
      </div>
    </div>
  );
}
