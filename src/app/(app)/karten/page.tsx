"use client";

import { useEffect, useState } from "react";
import { Layers, Lock, Loader2, Gift, Star } from "lucide-react";
import {
  CARD_SETS,
  CHESTS,
  chestCost,
  fmt,
  type CardSet,
  type GameState,
} from "@/lib/game/coinmaster";
import * as api from "@/lib/game/api";
import PageHeader from "@/components/PageHeader";

export default function KartenPage() {
  const [state, setState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [buyingChest, setBuyingChest] = useState<string | null>(null);

  useEffect(() => {
    api
      .fetchState()
      .then((r) => setState(r.state))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function openChest(chestId: string) {
    setBuyingChest(chestId);
    try {
      const res = await api.buyChest(chestId);
      if (res.state) setState(res.state);
    } catch {
    } finally {
      setBuyingChest(null);
    }
  }

  const cards = state?.cards ?? {};
  const completedSets = state?.completedSets ?? [];
  const villageIndex = state?.villageIndex ?? 0;

  return (
    <div>
      <PageHeader title="Karten" subtitle="Sammlung & Truhen" />

      <div className="space-y-5 px-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-brand" />
          </div>
        ) : (
          <>
            {/* Truhen kaufen */}
            <div>
              <h3 className="mb-3 font-bold flex items-center gap-2">
                <Gift size={18} /> Truhen offnen
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {CHESTS.map((chest) => {
                  const cost = chestCost(chest, villageIndex);
                  return (
                    <button
                      key={chest.id}
                      onClick={() => openChest(chest.id)}
                      disabled={buyingChest === chest.id || (state?.coins ?? 0) < cost}
                      className="card flex flex-col items-center gap-2 py-4 hover:border-brand/50 active:scale-95 transition disabled:opacity-40"
                    >
                      <span className="text-3xl">{chest.emoji}</span>
                      <p className="text-xs font-bold">{chest.name}</p>
                      <p className="text-[10px] text-gray-400">
                        {chest.cardCount} Karten
                      </p>
                      <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand-light">
                        {buyingChest === chest.id ? "..." : `${fmt(cost)} 🪙`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Kartensatze */}
            <div>
              <h3 className="mb-3 font-bold flex items-center gap-2">
                <Layers size={18} /> Kartensatze
              </h3>
              <div className="space-y-3">
                {CARD_SETS.map((set) => {
                  const isComplete = completedSets.includes(set.name);
                  const owned = set.cards.filter(
                    (c) => (cards[c.id] ?? 0) > 0
                  ).length;
                  const total = set.cards.length;
                  const progress = (owned / total) * 100;

                  return (
                    <div
                      key={set.name}
                      className={`card ${isComplete ? "border border-emerald-500/30 bg-emerald-500/5" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{set.emoji}</span>
                          <div>
                            <p className="font-bold">{set.name}</p>
                            <p className="text-xs text-gray-400">
                              {owned}/{total} Karten
                            </p>
                          </div>
                        </div>
                        {isComplete ? (
                          <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-300">
                            Komplett
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500">
                            +{set.rewardSpins} Spins
                          </span>
                        )}
                      </div>

                      {/* Fortschrittsbalken */}
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-border">
                        <div
                          className={`h-full transition-[width] duration-300 ${
                            isComplete
                              ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                              : "bg-gradient-to-r from-brand to-cyan-400"
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>

                      {/* Einzelne Karten */}
                      <div className="mt-3 grid grid-cols-5 gap-1.5">
                        {set.cards.map((card) => {
                          const count = cards[card.id] ?? 0;
                          return (
                            <div
                              key={card.id}
                              className={`flex flex-col items-center rounded-lg py-2 text-center ${
                                count > 0
                                  ? "bg-surface-border/50"
                                  : "bg-surface opacity-40"
                              }`}
                            >
                              {count > 0 ? (
                                <span className="text-lg">{card.emoji}</span>
                              ) : (
                                <Lock size={16} className="text-gray-600" />
                              )}
                              <span className="mt-0.5 text-[9px] text-gray-400 truncate w-full px-1">
                                {card.name}
                              </span>
                              {count > 1 && (
                                <span className="text-[9px] font-bold text-brand-light">
                                  x{count}
                                </span>
                              )}
                              <div className="mt-0.5 flex gap-px">
                                {Array.from({ length: card.rarity }).map((_, i) => (
                                  <Star
                                    key={i}
                                    size={6}
                                    className="text-yellow-400"
                                    fill="currentColor"
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
