"use client";

import { Trophy, Lock, Loader } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

interface Achievement {
  id: string;
  name: string;
  description: string;
  unlocked: boolean;
}

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAchievements();
  }, []);

  async function fetchAchievements() {
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

      const res = await fetch("/api/spiel/achievements", {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setAchievements(data);
      }
    } catch (err) {
      console.error("Failed to fetch achievements:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 pb-24">
        <div className="mb-6">
          <h1 className="text-3xl font-black">🏆 Erfolge</h1>
          <p className="text-sm text-gray-400">Meilensteine & Badges</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader size={32} className="animate-spin text-brand" />
        </div>
      </div>
    );
  }

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="space-y-6 pb-24">
      <div className="mb-6">
        <h1 className="text-3xl font-black">🏆 Erfolge</h1>
        <p className="text-sm text-gray-400">Meilensteine & Badges</p>
      </div>

      {/* Progress */}
      <div className="card bg-blue-500/10 border-blue-500/40 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-blue-300">{unlockedCount}/12 Erfolge freigeschaltet</span>
          <span className="text-xs font-bold text-blue-400">{Math.round((unlockedCount / 12) * 100)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-border">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-[width] duration-300"
            style={{ width: `${(unlockedCount / 12) * 100}%` }}
          />
        </div>
      </div>

      {/* Achievement Grid */}
      <div className="grid grid-cols-2 gap-3">
        {achievements.map((ach) => (
          <div
            key={ach.id}
            className={`rounded-lg p-3 text-center border transition ${
              ach.unlocked
                ? "bg-emerald-500/10 border-emerald-500/40"
                : "bg-surface border-surface-border opacity-50"
            }`}
          >
            <div className="flex justify-center mb-2">
              {ach.unlocked ? (
                <Trophy size={32} className="text-yellow-400" />
              ) : (
                <Lock size={32} className="text-gray-500" />
              )}
            </div>
            <h4 className="text-xs font-bold">{ach.name}</h4>
            <p className="text-[10px] text-gray-400 mt-1">{ach.description}</p>
            {ach.unlocked && <span className="text-[10px] text-emerald-400 mt-1 block">✓ Erreicht</span>}
          </div>
        ))}
      </div>

      {/* Tip */}
      <div className="card bg-blue-500/10 border border-blue-500/40 p-4">
        <p className="text-xs text-gray-400">
          🎯 <strong>Pro-Tipp:</strong> Erreiche alle 12 Erfolge und schalte exklusive Cosmetics frei!
        </p>
      </div>
    </div>
  );
}
