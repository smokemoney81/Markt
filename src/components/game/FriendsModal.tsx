"use client";

import { Gift, UserPlus, X } from "lucide-react";
import { useState } from "react";

export function FriendsModal({
  friendIds,
  onAddFriend,
  onRemoveFriend,
  onSendGift,
}: {
  friendIds: string[];
  onAddFriend: (userId: string) => Promise<void>;
  onRemoveFriend: (userId: string) => Promise<void>;
  onSendGift: (userId: string, coins: number, spins: number) => Promise<void>;
}) {
  const [newFriendId, setNewFriendId] = useState("");
  const [giftUser, setGiftUser] = useState<string | null>(null);
  const [giftCoins, setGiftCoins] = useState(100);
  const [giftSpins, setGiftSpins] = useState(5);

  const handleAddFriend = async () => {
    if (newFriendId.trim()) {
      await onAddFriend(newFriendId);
      setNewFriendId("");
    }
  };

  const handleSendGift = async () => {
    if (giftUser) {
      await onSendGift(giftUser, giftCoins, giftSpins);
      setGiftUser(null);
      setGiftCoins(100);
      setGiftSpins(5);
    }
  };

  return (
    <div className="py-4">
      <h3 className="mb-4 text-center text-lg font-extrabold lvl-heading">👥 Freunde</h3>

      {giftUser ? (
        <div className="mb-4 p-3 bg-surface rounded-lg">
          <h4 className="text-sm font-semibold mb-3">Geschenk an {giftUser.slice(0, 8)}</h4>
          <div className="space-y-2 text-sm">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Münzen</label>
              <input
                type="number"
                value={giftCoins}
                onChange={(e) => setGiftCoins(Math.max(0, parseInt(e.target.value)))}
                className="w-full rounded bg-surface-border px-2 py-1"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Spins</label>
              <input
                type="number"
                value={giftSpins}
                onChange={(e) => setGiftSpins(Math.max(0, parseInt(e.target.value)))}
                className="w-full rounded bg-surface-border px-2 py-1"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleSendGift}
              className="flex-1 btn bg-emerald-500 text-white font-semibold"
            >
              Senden
            </button>
            <button
              onClick={() => setGiftUser(null)}
              className="flex-1 btn bg-surface text-gray-300"
            >
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 p-3 bg-surface rounded-lg">
            <h4 className="text-sm font-semibold mb-2">Freund hinzufügen</h4>
            <div className="flex gap-2">
              <input
                type="text"
                value={newFriendId}
                onChange={(e) => setNewFriendId(e.target.value)}
                placeholder="User ID..."
                className="flex-1 rounded bg-surface-border px-2 py-1 text-sm"
              />
              <button
                onClick={handleAddFriend}
                className="btn bg-blue-500 text-white"
              >
                <UserPlus size={16} />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {friendIds.length === 0 ? (
              <p className="text-center text-xs text-gray-500">Noch keine Freunde</p>
            ) : (
              friendIds.map((fid) => (
                <div
                  key={fid}
                  className="flex items-center justify-between rounded bg-surface/50 p-2"
                >
                  <span className="text-xs text-gray-400">{fid.slice(0, 12)}...</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setGiftUser(fid)}
                      className="btn-sm bg-amber-500 text-white"
                    >
                      <Gift size={14} />
                    </button>
                    <button
                      onClick={() => onRemoveFriend(fid)}
                      className="btn-sm bg-red-500 text-white"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
