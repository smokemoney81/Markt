"use client";

import { TrendingUp, Zap, Coins, Target, Loader } from "lucide-react";
import { fmt } from "@/lib/game/coinmaster";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

interface PlayerStats {
  totalSpins: number;
  totalCoins: number;
  totalCoinsEarned: number;
  attacksWon: number;
  raidsWon: number;
  winRate: number;
  avgCoinsPerSpin: number;
  avgCoinsPerDay: number;
  avgSpinsPerDay: number;
  villageLevel: number;
  villageProgress: number;
  daysActive: number;
  lastSeenDaysAgo: number;
  streakDays: number;
  battlePassLevel: number;
  vipTier: number;
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      );

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        setLoading(false);
        return;
      }

      const res = await fetch("/api/spiel/analytics", {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 pb-24">
        <div className="mb-6">
          <h1 className="text-3xl font-black">📊 Statistik</h1>
          <p className="text-sm text-gray-400">Deine Spielerkarriere</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader size={32} className="animate-spin text-brand" />
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6 pb-24">
        <div className="mb-6">
          <h1 className="text-3xl font-black">📊 Statistik</h1>
          <p className="text-sm text-gray-400">Deine Spielerkarriere</p>
        </div>
        <div className="card bg-red-500/10 border-red-500/40 p-4">
          <p className="text-sm text-red-400">Fehler beim Laden der Statistiken</p>
        </div>
      </div>
    );
  }

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
            <span className="text-xs text-gray-400">Dorf erreicht</span>
          </div>
          <p className="text-lg font-black">Dorf {stats.villageLevel}/10</p>
          <p className="text-xs text-gray-400 mt-1">{stats.villageProgress}% Fortschritt</p>
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
        <div className="border-t border-surface-border pt-3 mt-3" />
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Tage aktiv</span>
          <span className="font-semibold">{stats.daysActive}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Tages-Streak</span>
          <span className="font-semibold text-cyan-400">{stats.streakDays} 🔥</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Battle Pass Level</span>
          <span className="font-semibold">{stats.battlePassLevel}</span>
        </div>
        {stats.vipTier > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">VIP-Status</span>
            <span className="font-semibold text-yellow-400">Tier {stats.vipTier}</span>
          </div>
        )}
      </div>
    </div>
  );
}
