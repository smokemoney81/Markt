"use client";

import { useEffect, useState } from "react";
import {
  Newspaper,
  Sword,
  Shield,
  Trophy,
  Gift,
  Star,
  Flame,
  Coins,
  Loader2,
} from "lucide-react";
import { fmt, VILLAGES, type GameState, type OfflineAttackNews } from "@/lib/game/coinmaster";
import * as api from "@/lib/game/api";
import PageHeader from "@/components/PageHeader";
import { EmptyState } from "@/components/ui";

type FeedItem = {
  id: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
  tone: string;
  time: string;
};

export default function FeedPage() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .fetchState()
      .then((r) => setItems(buildFeed(r.state, r.news ?? [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Feed" subtitle="Was ist passiert?" />

      <div className="space-y-3 px-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-brand" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Newspaper size={40} />}
            title="Noch nichts los"
            hint="Spiele eine Runde – deine Aktivitaten erscheinen hier."
          />
        ) : (
          items.map((it) => (
            <div key={it.id} className="card flex items-start gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${it.tone}`}
              >
                {it.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{it.title}</p>
                <p className="text-sm text-gray-400">{it.detail}</p>
              </div>
              <span className="shrink-0 text-[11px] text-gray-500">{it.time}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function buildFeed(state: GameState, news: OfflineAttackNews[]): FeedItem[] {
  const items: FeedItem[] = [];
  const village = VILLAGES[state.villageIndex] ?? VILLAGES[0];

  // Offline-Angriffe wahrend Abwesenheit
  news.forEach((n, i) => {
    if (n.blockedByShield) {
      items.push({
        id: `atk-${i}`,
        icon: <Shield size={18} />,
        title: `${n.enemy.emoji} ${n.enemy.name} abgewehrt`,
        detail: "Dein Schild hat den Angriff geblockt.",
        tone: "bg-blue-500/15 text-blue-300",
        time: "gerade",
      });
    } else {
      items.push({
        id: `atk-${i}`,
        icon: <Sword size={18} />,
        title: `${n.enemy.emoji} ${n.enemy.name} hat angegriffen`,
        detail:
          n.damagedSlot >= 0
            ? `${village.items[n.damagedSlot]?.name ?? "Gebaude"} beschadigt.`
            : "Ein Gebaude wurde beschadigt.",
        tone: "bg-red-500/15 text-red-300",
        time: "gerade",
      });
    }
  });

  // Streak
  if (state.dailyStreak > 0) {
    items.push({
      id: "streak",
      icon: <Flame size={18} />,
      title: `${state.dailyStreak}-Tage-Streak`,
      detail: "Weiter so – hol dir taglich deinen Bonus!",
      tone: "bg-orange-500/15 text-orange-300",
      time: "heute",
    });
  }

  // Dorf-Fortschritt
  const built = state.items.filter((i) => i === "built").length;
  if (built > 0) {
    items.push({
      id: "village",
      icon: <Trophy size={18} />,
      title: `${village.emoji} ${village.name}`,
      detail: `${built}/5 Gebaude fertiggestellt.`,
      tone: "bg-purple-500/15 text-purple-300",
      time: "aktuell",
    });
  }

  // Munzstand
  items.push({
    id: "coins",
    icon: <Coins size={18} />,
    title: `${fmt(state.coins)} Munzen im Beutel`,
    detail: `${state.spins} Spins bereit zum Drehen.`,
    tone: "bg-yellow-500/15 text-yellow-300",
    time: "aktuell",
  });

  // Sterne
  if (state.stars > 0) {
    items.push({
      id: "stars",
      icon: <Star size={18} />,
      title: `${fmt(state.stars)} Sterne gesammelt`,
      detail: "Schalte Themes und Belohnungen frei.",
      tone: "bg-amber-500/15 text-amber-300",
      time: "aktuell",
    });
  }

  // Kampf-Statistik
  if (state.attacksWon + state.raidsWon > 0) {
    items.push({
      id: "battles",
      icon: <Gift size={18} />,
      title: `${state.attacksWon + state.raidsWon} Kampfe gewonnen`,
      detail: `${state.attacksWon} Angriffe · ${state.raidsWon} Raids.`,
      tone: "bg-emerald-500/15 text-emerald-300",
      time: "gesamt",
    });
  }

  return items;
}
