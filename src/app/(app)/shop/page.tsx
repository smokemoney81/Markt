"use client";

import { useEffect, useState } from "react";
import { ShoppingBag, Zap, Gift, Loader2, Star } from "lucide-react";
import { fmt, MAX_SHIELDS } from "@/lib/game/coinmaster";
import { SHOP_PRODUCTS, REWARD_GRANT, REWARD_DAILY_CAP, type ShopProduct, type ShopOverview } from "@/lib/game/shop";
import * as api from "@/lib/game/api";
import PageHeader from "@/components/PageHeader";

export default function ShopPage() {
  const [shop, setShop] = useState<ShopOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [rewardClaiming, setRewardClaiming] = useState(false);
  const [rewardCount, setRewardCount] = useState(0);

  useEffect(() => {
    api
      .fetchShop()
      .then((s) => {
        setShop(s);
        setRewardCount(s.reward?.usedToday ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleBuy(product: ShopProduct) {
    setBuying(product.id);
    try {
      const result = await api.checkout(product.id);
      if ("url" in result) {
        window.location.href = result.url;
      }
    } catch {
    } finally {
      setBuying(null);
    }
  }

  async function handleReward() {
    if (rewardCount >= REWARD_DAILY_CAP) return;
    setRewardClaiming(true);
    try {
      await api.claimReward();
      setRewardCount((c) => c + 1);
    } catch {
    } finally {
      setRewardClaiming(false);
    }
  }

  const canReward = rewardCount < REWARD_DAILY_CAP;

  return (
    <div>
      <PageHeader title="Shop" subtitle="Munzen, Spins & Pakete" />

      <div className="space-y-5 px-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-brand" />
          </div>
        ) : (
          <>
            {/* Gratis-Belohnung */}
            <div className="card bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30">
              <div className="flex items-center gap-3 mb-3">
                <Gift size={24} className="text-green-400" />
                <div>
                  <p className="font-bold text-green-300">Tagliche Belohnung</p>
                  <p className="text-xs text-gray-400">
                    {rewardCount}/{REWARD_DAILY_CAP} heute abgeholt
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-300 mb-3">
                +{fmt(REWARD_GRANT.coins ?? 0)} 🪙 und +{REWARD_GRANT.spins ?? 0} Spins gratis!
              </p>
              <button
                onClick={handleReward}
                disabled={!canReward || rewardClaiming}
                className={`btn w-full ${canReward ? "bg-green-600 text-white hover:bg-green-700" : "btn-ghost opacity-50"}`}
              >
                {rewardClaiming ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : canReward ? (
                  "Belohnung abholen"
                ) : (
                  "Tagliches Limit erreicht"
                )}
              </button>
            </div>

            {/* Produkt-Grid */}
            <div>
              <h3 className="mb-3 font-bold flex items-center gap-2">
                <ShoppingBag size={18} /> Pakete
              </h3>
              <div className="space-y-3">
                {SHOP_PRODUCTS.map((p) => (
                  <div
                    key={p.id}
                    className={`card flex items-center gap-4 ${p.once ? "border border-yellow-500/30 bg-yellow-500/5" : ""}`}
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand/15">
                      {p.grant.spins ? (
                        <Zap size={22} className="text-brand-light" />
                      ) : (
                        <span className="text-xl">🪙</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold">{p.label}</p>
                        {p.once && (
                          <span className="rounded bg-yellow-500/20 px-1.5 py-0.5 text-[10px] font-bold text-yellow-300">
                            EINMALIG
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">{p.description}</p>
                    </div>
                    <button
                      onClick={() => handleBuy(p)}
                      disabled={buying === p.id}
                      className="btn-primary shrink-0 !px-4 !py-2 text-sm"
                    >
                      {buying === p.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        `${(p.priceCents / 100).toFixed(2)} €`
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* VIP-Teaser */}
            <div className="card bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/30">
              <div className="flex items-center gap-3">
                <Star size={24} className="text-yellow-400" />
                <div className="flex-1">
                  <p className="font-bold text-yellow-300">VIP-Status</p>
                  <p className="text-xs text-gray-400">
                    Monatliche Boni, exklusive Cosmetics & mehr
                  </p>
                </div>
                <a href="/vip" className="btn-primary !px-3 !py-1.5 text-xs">
                  Ansehen
                </a>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
