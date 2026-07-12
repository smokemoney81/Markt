"use client";

import { useState } from "react";
import { useTable } from "@/lib/useTable";
import type { Contact, ContactStatus } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import { Sheet, Field, EmptyState, StatusChip } from "@/components/ui";
import {
  Plus,
  Users,
  Pencil,
  Trash2,
  Phone,
  ShieldAlert,
  Star,
} from "lucide-react";

const STATUS: {
  value: ContactStatus;
  label: string;
  tone: "blue" | "yellow" | "green" | "cyan" | "red";
}[] = [
  { value: "neu", label: "Neu", tone: "blue" },
  { value: "screening", label: "Screening", tone: "yellow" },
  { value: "gebucht", label: "Gebucht", tone: "green" },
  { value: "stammkunde", label: "Stammkunde", tone: "cyan" },
  { value: "blacklist", label: "Blacklist", tone: "red" },
];

const empty = {
  name: "",
  phone: "",
  source: "markt.de",
  status: "neu" as ContactStatus,
  rating: "",
  screening_notes: "",
  notes: "",
};

export default function KontaktePage() {
  const { rows, loading, insert, update, remove } = useTable<Contact>(
    "contacts",
  );
  const [filter, setFilter] = useState<ContactStatus | "alle">("alle");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);

  const filtered =
    filter === "alle" ? rows : rows.filter((c) => c.status === filter);

  function openNew() {
    setEditId(null);
    setForm({ ...empty });
    setOpen(true);
  }
  function openEdit(c: Contact) {
    setEditId(c.id);
    setForm({
      name: c.name,
      phone: c.phone ?? "",
      source: c.source ?? "markt.de",
      status: c.status,
      rating: c.rating != null ? String(c.rating) : "",
      screening_notes: c.screening_notes ?? "",
      notes: c.notes ?? "",
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      phone: form.phone || null,
      source: form.source || null,
      status: form.status,
      rating: form.rating ? Number(form.rating) : null,
      screening_notes: form.screening_notes || null,
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

  return (
    <div>
      <PageHeader
        title="Kontakte"
        subtitle="Anfragen, Stammkunden & Blacklist"
        action={
          <button onClick={openNew} className="btn-primary !px-3" aria-label="Neu">
            <Plus size={18} />
          </button>
        }
      />

      {/* Filter-Tabs */}
      <div className="mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
        {(["alle", ...STATUS.map((s) => s.value)] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`chip whitespace-nowrap border ${
              filter === f
                ? "border-brand bg-brand/15 text-brand-light"
                : "border-surface-border text-gray-400"
            }`}
          >
            {f === "alle"
              ? "Alle"
              : STATUS.find((s) => s.value === f)?.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 px-4">
        {loading && <p className="text-sm text-gray-400">Lädt…</p>}

        {!loading && filtered.length === 0 && (
          <EmptyState
            icon={<Users size={40} />}
            title="Keine Kontakte"
            hint="Erfasse Anfragen, markiere Stammkunden und führe eine Blacklist für deine Sicherheit."
          />
        )}

        {filtered.map((c) => {
          const st = STATUS.find((s) => s.value === c.status)!;
          const isBlack = c.status === "blacklist";
          return (
            <div
              key={c.id}
              className={`card ${isBlack ? "border-red-500/40 bg-red-500/5" : ""}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {isBlack && (
                      <ShieldAlert size={16} className="text-red-400" />
                    )}
                    <h3 className="truncate font-semibold">{c.name}</h3>
                    <StatusChip label={st.label} tone={st.tone} />
                  </div>
                  <p className="mt-0.5 flex items-center gap-2 text-sm text-gray-400">
                    {c.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone size={12} /> {c.phone}
                      </span>
                    )}
                    {c.source && <span>· {c.source}</span>}
                  </p>
                  {c.rating ? (
                    <div className="mt-1 flex items-center gap-0.5 text-yellow-300">
                      {Array.from({ length: c.rating }).map((_, i) => (
                        <Star key={i} size={12} fill="currentColor" />
                      ))}
                    </div>
                  ) : null}
                  {c.screening_notes && (
                    <p className="mt-2 rounded-lg bg-surface px-2 py-1.5 text-xs text-gray-300">
                      🔒 {c.screening_notes}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => openEdit(c)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-surface-border"
                    aria-label="Bearbeiten"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => confirm("Kontakt löschen?") && remove(c.id)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-surface-border"
                    aria-label="Löschen"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? "Kontakt bearbeiten" : "Neuer Kontakt"}
      >
        <form onSubmit={save}>
          <Field label="Name / Spitzname">
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefon">
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Quelle">
              <select
                className="input"
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value })}
              >
                <option value="markt.de">markt.de</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="telefon">Telefon</option>
                <option value="sonstig">Sonstig</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select
                className="input"
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as ContactStatus })
                }
              >
                {STATUS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Bewertung (1–5)">
              <input
                className="input"
                type="number"
                min={1}
                max={5}
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: e.target.value })}
              />
            </Field>
          </div>
          <Field label="🔒 Screening-/Sicherheitsnotizen">
            <textarea
              className="input"
              rows={2}
              placeholder="z. B. Verifizierung, Auffälligkeiten, Warnungen"
              value={form.screening_notes}
              onChange={(e) =>
                setForm({ ...form, screening_notes: e.target.value })
              }
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
