"use client";

import { useEffect, useState } from "react";
import {
  Bell,
  Zap,
  Gift,
  Shield,
  Clock,
  Users,
  Loader2,
  CheckCheck,
} from "lucide-react";
import {
  DAILY_BONUS_HOURS,
  MAX_SHIELDS,
  MAX_SPINS,
  SPIN_REGEN_SECONDS,
  type GameState,
} from "@/lib/game/coinmaster";
import * as api from "@/lib/game/api";
import PageHeader from "@/components/PageHeader";
import { EmptyState } from "@/components/ui";

type Notif = {
  id: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
  tone: string;
  actionHref?: string;
  actionLabel?: string;
};

const READ_KEY = "mm_notifs_read_v1";

export default function BenachrichtigungenPage() {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(READ_KEY);
      if (raw) setReadIds(new Set(JSON.parse(raw)));
    } catch {}
    api
      .fetchState()
      .then((r) => setNotifs(buildNotifs(r.state)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function markAllRead() {
    const all = new Set(notifs.map((n) => n.id));
    setReadIds(all);
    try {
      localStorage.setItem(READ_KEY, JSON.stringify(Array.from(all)));
    } catch {}
  }

  const unread = notifs.filter((n) => !readIds.has(n.id)).length;

  return (
    <div>
      <PageHeader
        title="Benachrichtigungen"
        subtitle={unread > 0 ? `${unread} neu` : "Alles gelesen"}
        action={
          notifs.length > 0 && unread > 0 ? (
            <button
              onClick={markAllRead}
              className="btn-ghost !px-3 !py-1.5 text-xs"
              aria-label="Alle als gelesen markieren"
            >
              <CheckCheck size={16} />
            </button>
          ) : null
        }
      />

      <div className="space-y-3 px-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-brand" />
          </div>
        ) : notifs.length === 0 ? (
          <EmptyState
            icon={<Bell size={40} />}
            title="Keine Benachrichtigungen"
            hint="Wir sagen dir Bescheid, wenn Spins voll sind oder dein Tagesbonus bereit ist."
          />
        ) : (
          notifs.map((n) => {
            const isRead = readIds.has(n.id);
            return (
              <div
                key={n.id}
                className={`card flex items-start gap-3 ${isRead ? "opacity-60" : ""}`}
              >
                <div
                  className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${n.tone}`}
                >
                  {n.icon}
                  {!isRead && (
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand ring-2 ring-surface-card" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{n.title}</p>
                  <p className="text-sm text-gray-400">{n.detail}</p>
                  {n.actionHref && (
                    <a
                      href={n.actionHref}
                      className="mt-2 inline-block text-xs font-semibold text-brand-light"
                    >
                      {n.actionLabel} →
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function buildNotifs(state: GameState): Notif[] {
  const notifs: Notif[] = [];
  const now = Date.now();

  // Tagesbonus bereit?
  const sinceDaily = (now - state.lastDailyAt) / 3_600_000;
  if (sinceDaily >= DAILY_BONUS_HOURS) {
    notifs.push({
      id: "daily-ready",
      icon: <Gift size={18} />,
      title: "Tagesbonus bereit!",
      detail: "Hol dir deine tagliche Belohnung ab.",
      tone: "bg-green-500/15 text-green-300",
      actionHref: "/spiel",
      actionLabel: "Zum Spiel",
    });
  } else {
    const hoursLeft = Math.ceil(DAILY_BONUS_HOURS - sinceDaily);
    notifs.push({
      id: "daily-wait",
      icon: <Clock size={18} />,
      title: "Nachster Tagesbonus",
      detail: `In ca. ${hoursLeft} Std. verfugbar.`,
      tone: "bg-gray-500/15 text-gray-300",
    });
  }

  // Spins voll?
  if (state.spins >= MAX_SPINS) {
    notifs.push({
      id: "spins-full",
      icon: <Zap size={18} />,
      title: "Spins sind voll!",
      detail: `${MAX_SPINS} Spins bereit – dreh los, bevor sie verfallen.`,
      tone: "bg-yellow-500/15 text-yellow-300",
      actionHref: "/spiel",
      actionLabel: "Jetzt spielen",
    });
  } else {
    const missing = MAX_SPINS - state.spins;
    const mins = Math.ceil((missing * SPIN_REGEN_SECONDS) / 60);
    notifs.push({
      id: "spins-regen",
      icon: <Zap size={18} />,
      title: "Spins regenerieren",
      detail: `Voll in ca. ${mins} Min. (${state.spins}/${MAX_SPINS}).`,
      tone: "bg-blue-500/15 text-blue-300",
    });
  }

  // Schilde niedrig?
  if (state.shields < MAX_SHIELDS) {
    notifs.push({
      id: "shields-low",
      icon: <Shield size={18} />,
      title: "Schilde nicht voll",
      detail: `Nur ${state.shields}/${MAX_SHIELDS} Schilde – schutze dein Dorf.`,
      tone: "bg-red-500/15 text-red-300",
      actionHref: "/spiel",
      actionLabel: "Schilde holen",
    });
  }

  // Freunde-Erinnerung
  if ((state.friendIds?.length ?? 0) > 0) {
    notifs.push({
      id: "friends-gift",
      icon: <Users size={18} />,
      title: "Geschenke senden",
      detail: "Sende deinen Freunden heute wieder Gratis-Geschenke.",
      tone: "bg-cyan-500/15 text-cyan-300",
      actionHref: "/freunde",
      actionLabel: "Zu Freunden",
    });
  }

  return notifs;
}
