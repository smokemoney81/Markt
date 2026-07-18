"use client";

import { CheckCircle2, Circle, Zap, Target, Loader } from "lucide-react";
import { fmt } from "@/lib/game/coinmaster";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

interface Challenge {
  id: string;
  name: string;
  target: number;
  current: number;
  completed: boolean;
  reward: number;
  progress: number;
}

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchChallenges();
  }, []);

  async function fetchChallenges() {
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

      const res = await fetch("/api/spiel/challenges", {
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setChallenges(data);
      }
    } catch (err) {
      console.error("Failed to fetch challenges:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 pb-24">
        <div className="mb-6">
          <h1 className="text-3xl font-black">🎯 Wöchentliche Aufgaben</h1>
          <p className="text-sm text-gray-400">Erreiche Ziele & verdiene Münzen</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader size={32} className="animate-spin text-brand" />
        </div>
      </div>
    );
  }

  const completedCount = challenges.filter((c) => c.completed).length;

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
        <p className="text-gray-400 text-xs mt-1">
          {completedCount} von {challenges.length} Aufgaben abgeschlossen ({Math.round((completedCount / challenges.length) * 100)}%)
        </p>
      </div>

      {/* Challenge-Liste */}
      <div className="space-y-2">
        {challenges.map((challenge) => (
          <div
            key={challenge.id}
            className={`rounded-lg p-4 border transition ${
              challenge.completed
                ? "bg-emerald-500/10 border-emerald-500/40"
                : "bg-surface border-surface-border"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-1">
                {challenge.completed ? (
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
                      {challenge.current} / {challenge.target}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-border">
                    <div
                      className={`h-full transition-[width] duration-300 ${
                        challenge.completed
                          ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                          : "bg-gradient-to-r from-blue-500 to-cyan-500"
                      }`}
                      style={{ width: `${challenge.progress}%` }}
                    />
                  </div>
                </div>

                {challenge.completed && (
                  <button className="btn-sm bg-emerald-500 text-white font-semibold w-full">
                    Belohnung abholen
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tips */}
      <div className="card bg-purple-500/10 border-purple-500/40 p-4">
        <div className="flex gap-3">
          <Target size={20} className="text-purple-400 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-purple-300">Pro-Tipp</p>
            <p className="text-xs text-gray-400 mt-1">
              Vervollständige alle {challenges.length} Aufgaben für einen Bonusboost! (+1000 🪙 extra)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
