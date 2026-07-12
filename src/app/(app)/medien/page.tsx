"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTable } from "@/lib/useTable";
import type { MediaItem } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import { EmptyState } from "@/components/ui";
import {
  Upload,
  Images,
  Trash2,
  Star,
  Loader2,
  PlayCircle,
} from "lucide-react";

export default function MedienPage() {
  const { rows, loading, insert, update, remove } = useTable<MediaItem>(
    "media",
  );
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"alle" | "foto" | "video" | "favoriten">(
    "alle",
  );

  // Signierte URLs für die privaten Dateien erzeugen
  const loadUrls = useCallback(async () => {
    const next: Record<string, string> = {};
    await Promise.all(
      rows.map(async (m) => {
        const { data } = await supabase.storage
          .from("media")
          .createSignedUrl(m.storage_path, 3600);
        if (data?.signedUrl) next[m.id] = data.signedUrl;
      }),
    );
    setUrls(next);
  }, [rows, supabase]);

  useEffect(() => {
    if (rows.length) loadUrls();
  }, [rows, loadUrls]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      for (const file of files) {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${user?.id}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage
          .from("media")
          .upload(path, file, { upsert: false });
        if (error) {
          alert(`Upload fehlgeschlagen: ${error.message}`);
          continue;
        }
        await insert({
          kind: file.type.startsWith("video") ? "video" : "foto",
          storage_path: path,
          title: file.name,
        });
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function del(m: MediaItem) {
    if (!confirm("Datei löschen?")) return;
    await supabase.storage.from("media").remove([m.storage_path]);
    await remove(m.id);
  }

  const filtered = rows.filter((m) => {
    if (filter === "favoriten") return m.is_favorite;
    if (filter === "foto") return m.kind === "foto";
    if (filter === "video") return m.kind === "video";
    return true;
  });

  return (
    <div>
      <PageHeader
        title="Medien"
        subtitle="Fotos & Videos für deine Anzeigen"
        action={
          <button
            onClick={() => fileRef.current?.click()}
            className="btn-primary !px-3"
            disabled={uploading}
            aria-label="Hochladen"
          >
            {uploading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Upload size={18} />
            )}
          </button>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={onPick}
      />

      {/* Filter */}
      <div className="mb-3 flex gap-2 px-4">
        {(["alle", "foto", "video", "favoriten"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`chip border capitalize ${
              filter === f
                ? "border-brand bg-brand/15 text-brand-light"
                : "border-surface-border text-gray-400"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="px-4">
        {loading && <p className="text-sm text-gray-400">Lädt…</p>}

        {!loading && filtered.length === 0 && (
          <EmptyState
            icon={<Images size={40} />}
            title="Noch keine Medien"
            hint="Lade Fotos und Videos hoch, markiere Favoriten und halte deine Anzeigen-Sets organisiert."
          />
        )}

        <div className="grid grid-cols-3 gap-2">
          {filtered.map((m) => (
            <div
              key={m.id}
              className="group relative aspect-square overflow-hidden rounded-xl border border-surface-border bg-surface"
            >
              {urls[m.id] ? (
                m.kind === "video" ? (
                  <div className="relative h-full w-full">
                    <video
                      src={urls[m.id]}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                    />
                    <PlayCircle
                      className="absolute inset-0 m-auto text-white/80"
                      size={32}
                    />
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={urls[m.id]}
                    alt={m.title ?? ""}
                    className="h-full w-full object-cover"
                  />
                )
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="animate-spin text-gray-600" size={20} />
                </div>
              )}

              {/* Aktionen */}
              <button
                onClick={() => update(m.id, { is_favorite: !m.is_favorite })}
                className="absolute left-1.5 top-1.5 rounded-full bg-black/50 p-1.5"
                aria-label="Favorit"
              >
                <Star
                  size={14}
                  className={
                    m.is_favorite ? "text-yellow-300" : "text-white/70"
                  }
                  fill={m.is_favorite ? "currentColor" : "none"}
                />
              </button>
              <button
                onClick={() => del(m)}
                className="absolute right-1.5 top-1.5 rounded-full bg-black/50 p-1.5 text-white/80"
                aria-label="Löschen"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
