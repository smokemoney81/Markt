"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Gamepad2,
  Zap,
  Trophy,
  Gift,
  ShoppingBag,
  Users,
  Layers,
  TrendingUp,
  LogOut,
  Flame,
  Star,
  ChevronRight,
} from "lucide-react";
import { fmt, VILLAGES, type GameState } from "@/lib/game/coinmaster";
import * as api from "@/lib/game/api";

export default function DashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .fetchState()
      .then((r) => setState(r.state))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const village = state ? VILLAGES[state.villageIndex] ?? VILLAGES[0] : null;
  const builtCount = state
    ? state.items.filter((i) => i === "built").length
    : 0;

  return (
    <div>
      <header className="safe-top flex items-center justify-between px-4 pb-2 pt-5">
        <div>
          <p className="text-sm text-gray-400">Willkommen zurück</p>
          <h1 className="text-2xl font-extrabold tracking-tight">
            Munz-Meister
          </h1>
        </div>
        <button
          onClick={logout}
          className="rounded-full border border-surface-border p-2.5 text-gray-300 hover:bg-surface-border"
          aria-label="Abmelden"
        >
          <LogOut size={18} />
        </button>
      </header>

      <div className="space-y-4 px-4">
        {loading ? (
          <div className="card animate-pulse py-12 text-center text-gray-500">
            Laden...
          </div>
        ) : !state ? (
          <Link
            href="/spiel"
            className="card bg-gradient-to-br from-brand-dark to-surface-card py-8 text-center"
          >
            <Gamepad2 size={40} className="mx-auto mb-3 text-brand-light" />
            <p className="text-lg font-bold">Spiel starten</p>
            <p className="mt-1 text-sm text-gray-400">
              Drehe das Rad und baue dein Dorf auf!
            </p>
          </Link>
        ) : (
          <>
            {/* Hauptstatus */}
            <div className="card bg-gradient-to-br from-brand-dark to-surface-card">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-cyan-100">
                    {village?.emoji} {village?.name}
                  </p>
                  <p className="mt-1 text-3xl font-extrabold">
                    {fmt(state.coins)} 🪙
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-cyan-100">
                    <Zap size={14} className="mr-1 inline" />
                    {state.spins} Spins
                  </p>
                  <p className="mt-1 text-sm text-cyan-100">
                    🛡️ {state.shields} Schilde
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-black/30">
                  <div
                    className="h-full bg-gradient-to-r from-brand to-cyan-400 transition-[width] duration-300"
                    style={{ width: `${(builtCount / 5) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-cyan-100">
                  {builtCount}/5 gebaut
                </span>
              </div>
            </div>

            {/* Streak & Sterne */}
            <div className="grid grid-cols-3 gap-3">
              <div className="card py-3 text-center">
                <Flame size={20} className="mx-auto mb-1 text-orange-400" />
                <p className="text-lg font-extrabold">{state.dailyStreak}</p>
                <p className="text-[11px] text-gray-400">Streak</p>
              </div>
              <div className="card py-3 text-center">
                <Star size={20} className="mx-auto mb-1 text-yellow-400" />
                <p className="text-lg font-extrabold">{fmt(state.stars)}</p>
                <p className="text-[11px] text-gray-400">Sterne</p>
              </div>
              <div className="card py-3 text-center">
                <Trophy size={20} className="mx-auto mb-1 text-purple-400" />
                <p className="text-lg font-extrabold">{state.villageIndex + 1}</p>
                <p className="text-[11px] text-gray-400">Dorf-Lv.</p>
              </div>
            </div>

            {/* Schnell-Aktion: Spielen */}
            <Link
              href="/spiel"
              className="flex items-center gap-4 rounded-2xl bg-brand/15 border border-brand/30 p-4"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white">
                <Gamepad2 size={24} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-brand-light">Jetzt spielen</p>
                <p className="text-sm text-gray-400">
                  {state.spins} Spins verfugbar
                </p>
              </div>
              <ChevronRight size={20} className="text-brand-light" />
            </Link>
          </>
        )}

        {/* Quick-Links Grid */}
        <div className="grid grid-cols-2 gap-3">
          <QuickLink
            href="/shop"
            icon={<ShoppingBag size={20} />}
            label="Shop"
            hint="Munzen & Spins"
            color="from-yellow-500/15 to-amber-500/15 border-yellow-500/30"
            iconColor="text-yellow-400"
          />
          <QuickLink
            href="/karten"
            icon={<Layers size={20} />}
            label="Karten"
            hint="Sammlung"
            color="from-purple-500/15 to-pink-500/15 border-purple-500/30"
            iconColor="text-purple-400"
          />
          <QuickLink
            href="/freunde"
            icon={<Users size={20} />}
            label="Freunde"
            hint="Geschenke senden"
            color="from-blue-500/15 to-cyan-500/15 border-blue-500/30"
            iconColor="text-blue-400"
          />
          <QuickLink
            href="/profil"
            icon={<TrendingUp size={20} />}
            label="Profil"
            hint="Stats & Einstellungen"
            color="from-emerald-500/15 to-teal-500/15 border-emerald-500/30"
            iconColor="text-emerald-400"
          />
        </div>

        {/* Weitere Features */}
        <div className="space-y-2">
          <SmallLink href="/achievements" icon={<Trophy size={16} />} label="Erfolge" />
          <SmallLink href="/challenges" icon={<Gift size={16} />} label="Wochentliche Aufgaben" />
          <SmallLink href="/seasonal" icon={<Star size={16} />} label="Saisonale Events" />
          <SmallLink href="/vip" icon={<Zap size={16} />} label="VIP-Vorteile" />
        </div>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon,
  label,
  hint,
  color,
  iconColor,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
  color: string;
  iconColor: string;
}) {
  return (
    <Link
      href={href}
      className={`card bg-gradient-to-br ${color} border`}
    >
      <div
        className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-black/20 ${iconColor}`}
      >
        {icon}
      </div>
      <p className="font-bold">{label}</p>
      <p className="text-xs text-gray-400">{hint}</p>
    </Link>
  );
}

function SmallLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="card flex items-center gap-3 !py-3"
    >
      <div className="text-gray-400">{icon}</div>
      <span className="flex-1 text-sm font-medium">{label}</span>
      <ChevronRight size={16} className="text-gray-500" />
    </Link>
  );
}
