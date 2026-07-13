"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  TrendingUp,
  Zap,
  Sword,
  Target,
  Flame,
  Trophy,
  Loader2,
  LogOut,
  RotateCcw,
  Palette,
  Copy,
  Check,
} from "lucide-react";
import {
  fmt,
  COSMETIC_THEMES,
  type GameState,
} from "@/lib/game/coinmaster";
import * as api from "@/lib/game/api";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";

export default function ProfilPage() {
  const router = useRouter();
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      api.fetchState().then((r) => setState(r.state)),
      createClient()
        .auth.getUser()
        .then(({ data }) => setUserId(data.user?.id ?? null)),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleTheme(theme: "default" | "neon" | "cyber" | "mystic") {
    try {
      const res = await api.selectTheme(theme);
      if (res.state) setState(res.state);
    } catch {}
  }

  async function handleReset() {
    if (!confirm("Spielstand wirklich zurucksetzen? Das kann nicht ruckgangig gemacht werden!")) return;
    try {
      const res = await api.resetGame();
      if (res.state) setState(res.state);
    } catch {}
  }

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  function copyId() {
    if (!userId) return;
    navigator.clipboard.writeText(userId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div>
        <PageHeader title="Profil" subtitle="Spieler-Infos & Einstellungen" />
        <div className="flex items-center justify-center py-12">
          <Loader2 size={32} className="animate-spin text-brand" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Profil" subtitle="Spieler-Infos & Einstellungen" />

      <div className="space-y-5 px-4">
        {/* Spieler-ID */}
        <div className="card flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/15">
            <User size={28} className="text-brand-light" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-bold">Spieler</p>
            <p className="truncate text-xs text-gray-400 font-mono">
              {userId?.slice(0, 12)}...
            </p>
          </div>
          <button
            onClick={copyId}
            className="rounded-lg bg-surface-border p-2 text-gray-400 hover:text-white"
            aria-label="ID kopieren"
          >
            {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
          </button>
        </div>

        {state && (
          <>
            {/* Statistiken */}
            <div>
              <h3 className="mb-3 font-bold flex items-center gap-2">
                <TrendingUp size={18} /> Statistiken
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={<Zap size={18} className="text-blue-400" />}
                  label="Spins gesamt"
                  value={fmt(state.totalSpins)}
                />
                <StatCard
                  icon={<Sword size={18} className="text-red-400" />}
                  label="Angriffe gewonnen"
                  value={String(state.attacksWon)}
                />
                <StatCard
                  icon={<Target size={18} className="text-emerald-400" />}
                  label="Raids gewonnen"
                  value={String(state.raidsWon)}
                />
                <StatCard
                  icon={<Flame size={18} className="text-orange-400" />}
                  label="Tages-Streak"
                  value={`${state.dailyStreak} Tage`}
                />
                <StatCard
                  icon={<Trophy size={18} className="text-yellow-400" />}
                  label="Sterne"
                  value={fmt(state.stars)}
                />
                <StatCard
                  icon={<TrendingUp size={18} className="text-purple-400" />}
                  label="Dorf-Level"
                  value={`${state.villageIndex + 1}/10`}
                />
              </div>
            </div>

            {/* Theme-Auswahl */}
            <div>
              <h3 className="mb-3 font-bold flex items-center gap-2">
                <Palette size={18} /> Aussehen
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {(
                  Object.entries(COSMETIC_THEMES) as [
                    keyof typeof COSMETIC_THEMES,
                    (typeof COSMETIC_THEMES)[keyof typeof COSMETIC_THEMES],
                  ][]
                ).map(([key, theme]) => {
                  const active = state.selectedTheme === key;
                  const unlocked = state.stars >= theme.unlock;
                  return (
                    <button
                      key={key}
                      onClick={() => unlocked && handleTheme(key)}
                      disabled={!unlocked}
                      className={`card flex items-center gap-2 !py-3 transition active:scale-95 ${
                        active
                          ? "border-brand bg-brand/10"
                          : unlocked
                            ? "hover:border-brand/30"
                            : "opacity-40"
                      }`}
                    >
                      <span className="text-sm font-semibold">{theme.name}</span>
                      {!unlocked && (
                        <span className="text-[10px] text-gray-500">
                          {theme.unlock} ★
                        </span>
                      )}
                      {active && (
                        <Check size={14} className="ml-auto text-brand-light" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Aktionen */}
        <div className="space-y-2 pt-2">
          <button
            onClick={handleReset}
            className="btn-ghost w-full flex items-center justify-center gap-2 text-red-400"
          >
            <RotateCcw size={16} /> Spielstand zurucksetzen
          </button>
          <button
            onClick={logout}
            className="btn-ghost w-full flex items-center justify-center gap-2 text-gray-400"
          >
            <LogOut size={16} /> Abmelden
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="card !py-3">
      <div className="mb-1">{icon}</div>
      <p className="text-lg font-extrabold">{value}</p>
      <p className="text-[11px] text-gray-400">{label}</p>
    </div>
  );
}
