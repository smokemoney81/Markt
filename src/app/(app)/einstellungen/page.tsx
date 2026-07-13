"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Volume2,
  Vibrate,
  Sparkles,
  Bell,
  Gem,
  RotateCcw,
  LogOut,
  Info,
  ChevronRight,
} from "lucide-react";
import * as api from "@/lib/game/api";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";

type Prefs = {
  sound: boolean;
  haptics: boolean;
  animations: boolean;
  notifications: boolean;
};

const PREFS_KEY = "mm_prefs_v1";
const DEFAULT_PREFS: Prefs = {
  sound: true,
  haptics: true,
  animations: true,
  notifications: true,
};

export default function EinstellungenPage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(raw) });
    } catch {}
  }, []);

  function toggle(key: keyof Prefs) {
    setPrefs((p) => {
      const next = { ...p, [key]: !p[key] };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }

  async function handleReset() {
    if (
      !confirm(
        "Spielstand wirklich zurucksetzen? Das kann nicht ruckgangig gemacht werden!"
      )
    )
      return;
    try {
      await api.resetGame();
      alert("Spielstand zuruckgesetzt.");
    } catch {}
  }

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div>
      <PageHeader title="Einstellungen" subtitle="App & Konto verwalten" />

      <div className="space-y-5 px-4">
        {/* Spiel-Einstellungen */}
        <div>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">
            Spiel
          </h3>
          <div className="card divide-y divide-surface-border !p-0">
            <ToggleRow
              icon={<Volume2 size={18} className="text-blue-400" />}
              label="Ton"
              hint="Sound-Effekte im Spiel"
              on={prefs.sound}
              onToggle={() => toggle("sound")}
            />
            <ToggleRow
              icon={<Vibrate size={18} className="text-purple-400" />}
              label="Vibration"
              hint="Haptisches Feedback"
              on={prefs.haptics}
              onToggle={() => toggle("haptics")}
            />
            <ToggleRow
              icon={<Sparkles size={18} className="text-yellow-400" />}
              label="Animationen"
              hint="Effekte & Ubergange"
              on={prefs.animations}
              onToggle={() => toggle("animations")}
            />
            <ToggleRow
              icon={<Bell size={18} className="text-green-400" />}
              label="Benachrichtigungen"
              hint="Erinnerungen an Boni & Spins"
              on={prefs.notifications}
              onToggle={() => toggle("notifications")}
            />
          </div>
        </div>

        {/* Konto */}
        <div>
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">
            Konto
          </h3>
          <div className="card divide-y divide-surface-border !p-0">
            <LinkRow
              icon={<Gem size={18} className="text-yellow-400" />}
              label="VIP-Status"
              href="/vip"
            />
            <LinkRow
              icon={<Info size={18} className="text-gray-400" />}
              label="Profil & Statistik"
              href="/profil"
            />
          </div>
        </div>

        {/* Gefahrenzone */}
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

        <p className="pb-4 text-center text-xs text-gray-600">
          Munz-Meister · Version 1.0
        </p>
      </div>
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  hint,
  on,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{label}</p>
        <p className="text-xs text-gray-400">{hint}</p>
      </div>
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={onToggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          on ? "bg-brand" : "bg-surface-border"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
            on ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

function LinkRow({
  icon,
  label,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
}) {
  return (
    <a href={href} className="flex items-center gap-3 p-4">
      <div className="shrink-0">{icon}</div>
      <span className="flex-1 font-medium">{label}</span>
      <ChevronRight size={16} className="text-gray-500" />
    </a>
  );
}
