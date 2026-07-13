"use client";

import { useEffect, useState } from "react";
import { Users, Gift, UserPlus, Trash2, Loader2, Send } from "lucide-react";
import { fmt } from "@/lib/game/coinmaster";
import * as api from "@/lib/game/api";
import PageHeader from "@/components/PageHeader";
import { Sheet, Field, EmptyState } from "@/components/ui";

interface Friend {
  id: string;
  displayName: string;
  villageLevel: number;
  lastSeen: string;
  canGift: boolean;
}

export default function FreundePage() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [friendCode, setFriendCode] = useState("");
  const [adding, setAdding] = useState(false);
  const [giftSending, setGiftSending] = useState<string | null>(null);

  useEffect(() => {
    api
      .fetchFriends()
      .then((data) => setFriends(data.friends ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!friendCode.trim()) return;
    setAdding(true);
    try {
      await api.addFriend(friendCode.trim());
      const data = await api.fetchFriends();
      setFriends(data.friends ?? []);
      setFriendCode("");
      setAddOpen(false);
    } catch {
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(friendId: string) {
    if (!confirm("Freund entfernen?")) return;
    try {
      await api.removeFriend(friendId);
      setFriends((f) => f.filter((x) => x.id !== friendId));
    } catch {}
  }

  async function handleGift(friendId: string) {
    setGiftSending(friendId);
    try {
      await api.sendGift(friendId, 1000, 1);
      setFriends((prev) =>
        prev.map((f) => (f.id === friendId ? { ...f, canGift: false } : f))
      );
    } catch {
    } finally {
      setGiftSending(null);
    }
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} Min.`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} Std.`;
    return `${Math.floor(hours / 24)} T.`;
  }

  return (
    <div>
      <PageHeader
        title="Freunde"
        subtitle="Geschenke senden & empfangen"
        action={
          <button
            onClick={() => setAddOpen(true)}
            className="btn-primary !px-3"
            aria-label="Freund hinzufugen"
          >
            <UserPlus size={18} />
          </button>
        }
      />

      <div className="space-y-3 px-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="animate-spin text-brand" />
          </div>
        ) : friends.length === 0 ? (
          <EmptyState
            icon={<Users size={40} />}
            title="Noch keine Freunde"
            hint="Fuge Freunde hinzu, um taglich Geschenke zu senden und Bonus-Spins zu erhalten!"
          />
        ) : (
          <>
            {/* Geschenk-Info */}
            <div className="card bg-blue-500/10 border border-blue-500/30 flex items-center gap-3">
              <Gift size={20} className="shrink-0 text-blue-400" />
              <p className="text-xs text-gray-300">
                Sende taglich <strong>1.000 🪙 + 1 Spin</strong> an jeden Freund!
              </p>
            </div>

            {/* Freundesliste */}
            {friends.map((f) => (
              <div key={f.id} className="card flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand/15 text-lg font-bold text-brand-light">
                  {f.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{f.displayName}</p>
                  <p className="text-xs text-gray-400">
                    Dorf {f.villageLevel} · Zuletzt vor {timeAgo(f.lastSeen)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {f.canGift && (
                    <button
                      onClick={() => handleGift(f.id)}
                      disabled={giftSending === f.id}
                      className="rounded-lg bg-brand/15 p-2 text-brand-light hover:bg-brand/25"
                      aria-label="Geschenk senden"
                    >
                      {giftSending === f.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Send size={16} />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => handleRemove(f.id)}
                    className="rounded-lg p-2 text-gray-500 hover:bg-surface-border"
                    aria-label="Entfernen"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <Sheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Freund hinzufugen"
      >
        <form onSubmit={handleAdd}>
          <Field label="Freundescode / Spieler-ID">
            <input
              className="input"
              placeholder="z.B. abc123..."
              required
              value={friendCode}
              onChange={(e) => setFriendCode(e.target.value)}
            />
          </Field>
          <p className="mb-4 text-xs text-gray-400">
            Den Code findest du im Profil deines Freundes.
          </p>
          <button
            type="submit"
            className="btn-primary w-full"
            disabled={adding}
          >
            {adding ? "Wird hinzugefugt..." : "Hinzufugen"}
          </button>
        </form>
      </Sheet>
    </div>
  );
}
