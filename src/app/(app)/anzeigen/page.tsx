"use client";

import { useState } from "react";
import { useTable } from "@/lib/useTable";
import { bumpDue } from "@/lib/format";
import type { Ad, AdStatus } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import { Sheet, Field, EmptyState, StatusChip } from "@/components/ui";
import {
  Plus,
  Megaphone,
  ArrowUpToLine,
  Pencil,
  Trash2,
  ExternalLink,
} from "lucide-react";

const STATUS: { value: AdStatus; label: string; tone: "green" | "yellow" | "gray" }[] =
  [
    { value: "aktiv", label: "Aktiv", tone: "green" },
    { value: "pausiert", label: "Pausiert", tone: "yellow" },
    { value: "abgelaufen", label: "Abgelaufen", tone: "gray" },
  ];

const empty = {
  title: "",
  city: "",
  category: "",
  url: "",
  status: "aktiv" as AdStatus,
  price_paid: "",
  bump_interval_hours: 24,
  notes: "",
};

export default function AnzeigenPage() {
  const { rows, loading, insert, update, remove } = useTable<Ad>("ads");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);

  function openNew() {
    setEditId(null);
    setForm({ ...empty });
    setOpen(true);
  }

  function openEdit(a: Ad) {
    setEditId(a.id);
    setForm({
      title: a.title,
      city: a.city ?? "",
      category: a.category ?? "",
      url: a.url ?? "",
      status: a.status,
      price_paid: a.price_paid != null ? String(a.price_paid) : "",
      bump_interval_hours: a.bump_interval_hours,
      notes: a.notes ?? "",
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title: form.title,
      city: form.city || null,
      category: form.category || null,
      url: form.url || null,
      status: form.status,
      price_paid: form.price_paid ? Number(form.price_paid) : null,
      bump_interval_hours: Number(form.bump_interval_hours) || 24,
      notes: form.notes || null,
    };
    try {
      if (editId) await update(editId, payload);
      else await insert(payload);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function bumpNow(a: Ad) {
    await update(a.id, { last_bumped_at: new Date().toISOString() });
  }

  return (
    <div>
      <PageHeader
        title="Anzeigen"
        subtitle="markt.de & Co. verwalten"
        action={
          <button onClick={openNew} className="btn-primary !px-3" aria-label="Neu">
            <Plus size={18} />
          </button>
        }
      />

      <div className="space-y-3 px-4">
        {loading && <p className="text-sm text-gray-400">Lädt…</p>}

        {!loading && rows.length === 0 && (
          <EmptyState
            icon={<Megaphone size={40} />}
            title="Noch keine Anzeigen"
            hint="Lege deine markt.de-Anzeige an und werde an das regelmäßige Hochschieben erinnert."
          />
        )}

        {rows.map((a) => {
          const due = bumpDue(a.last_bumped_at, a.bump_interval_hours);
          const st = STATUS.find((s) => s.value === a.status)!;
          return (
            <div key={a.id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-semibold">{a.title}</h3>
                    <StatusChip label={st.label} tone={st.tone} />
                  </div>
                  <p className="mt-0.5 text-sm text-gray-400">
                    {[a.city, a.category].filter(Boolean).join(" · ") ||
                      a.platform}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {a.url && (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg p-2 text-gray-400 hover:bg-surface-border"
                      aria-label="Öffnen"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                  <button
                    onClick={() => openEdit(a)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-surface-border"
                    aria-label="Bearbeiten"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => confirm("Anzeige löschen?") && remove(a.id)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-surface-border"
                    aria-label="Löschen"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {a.status === "aktiv" && (
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-surface-border pt-3">
                  <span
                    className={`text-sm ${
                      due.overdue ? "text-yellow-300" : "text-gray-400"
                    }`}
                  >
                    {due.overdue
                      ? "Jetzt fällig zum Hochschieben"
                      : `Nächster Bump in ${Math.ceil(due.dueInHours)} h`}
                  </span>
                  <button
                    onClick={() => bumpNow(a)}
                    className={`btn !py-1.5 !px-3 text-xs ${
                      due.overdue ? "bg-brand text-white" : "btn-ghost"
                    }`}
                  >
                    <ArrowUpToLine size={14} /> Hochgeschoben
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? "Anzeige bearbeiten" : "Neue Anzeige"}
      >
        <form onSubmit={save}>
          <Field label="Titel">
            <input
              className="input"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stadt">
              <input
                className="input"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </Field>
            <Field label="Kategorie">
              <input
                className="input"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Link zur Anzeige (URL)">
            <input
              className="input"
              type="url"
              placeholder="https://www.markt.de/..."
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select
                className="input"
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as AdStatus })
                }
              >
                {STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Bump-Intervall (Std.)">
              <input
                className="input"
                type="number"
                min={1}
                value={form.bump_interval_hours}
                onChange={(e) =>
                  setForm({
                    ...form,
                    bump_interval_hours: Number(e.target.value),
                  })
                }
              />
            </Field>
          </div>
          <Field label="Anzeigenkosten (€)">
            <input
              className="input"
              type="number"
              step="0.01"
              value={form.price_paid}
              onChange={(e) => setForm({ ...form, price_paid: e.target.value })}
            />
          </Field>
          <Field label="Notizen">
            <textarea
              className="input"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? "Speichert…" : "Speichern"}
          </button>
        </form>
      </Sheet>
    </div>
  );
}
