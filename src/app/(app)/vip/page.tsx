import { Gem, Check, Zap } from "lucide-react";
import { VIP_TIERS } from "@/lib/game/coinmaster";
import { fmt } from "@/lib/game/coinmaster";

export default function VIPPage() {
  return (
    <div className="space-y-6 pb-24">
      <div className="mb-6">
        <h1 className="text-3xl font-black">💎 VIP</h1>
        <p className="text-sm text-gray-400">Premium-Vorteile freischalten</p>
      </div>

      <div className="space-y-3">
        {VIP_TIERS.map((tier) => (
          <div
            key={tier.tier}
            className={`rounded-lg p-4 border transition ${
              tier.tier === 0
                ? "bg-surface border-surface-border"
                : "bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border-yellow-500/40 hover:border-yellow-500/60"
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-bold flex items-center gap-2">
                  {tier.tier > 0 && <Gem size={18} className="text-yellow-400" />}
                  {tier.name}
                </h3>
                <p className="text-xs text-gray-400 mt-1">{tier.costUSD > 0 ? `$${tier.costUSD}/Monat` : "Kostenlos"}</p>
              </div>
              {tier.tier > 0 && (
                <button className="btn-sm bg-yellow-500 text-yellow-950 font-semibold hover:bg-yellow-600 active:scale-95">
                  Kaufen
                </button>
              )}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-300">
                <Zap size={16} className="text-yellow-400" />
                <span>+{fmt(tier.monthlyBonus)} 🪙 monatlich</span>
              </div>
              {tier.tier > 0 && (
                <>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Check size={16} className="text-emerald-400" />
                    <span>Früher Spins bekommen</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Check size={16} className="text-emerald-400" />
                    <span>Exklusive Cosmetics</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    <Check size={16} className="text-emerald-400" />
                    <span>Double XP auf Challenges</span>
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="card bg-amber-500/10 border border-amber-500/40 p-4">
        <p className="text-xs text-gray-400">
          💡 <strong>Tipp:</strong> VIP wird nach 30 Tagen automatisch verlängert, falls aktiviert. Kündigung jederzeit möglich.
        </p>
      </div>
    </div>
  );
}
