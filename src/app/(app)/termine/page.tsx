"use client";

import { useState } from "react";
import { useTable } from "@/lib/useTable";
import { euro, dateTime } from "@/lib/format";
import type { Appointment, AppointmentStatus, Contact } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import { Sheet, Field, EmptyState, StatusChip } from "@/components/ui";
import {
  Plus,
  CalendarDays,
  Pencil,
  Trash2,
  MapPin,
  BadgeCheck,
  CircleDollarSign,
} from "lucide-react";

const STATUS: {
  value: AppointmentStatus;
  label: string;
  tone: "blue" | "green" | "gray" | "red" | "yellow";
}[] = [
  { value: "geplant", label: "Geplant", tone: "blue" },
  { value: "bestaetigt", label: "Bestätigt", tone: "yellow" },
  { value: "erledigt", label: "Erledigt", tone: "green" },
  { value: "abgesagt", label: "Abgesagt", tone: "gray" },
  { value: "no_show", label: "No-Show", tone: "red" },
];

function toLocalInput(iso?: string) {
  const d = iso ? new Date(iso) : new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

const empty = () => ({
  title: "",
  contact_id: "",
  starts_at: toLocalInput(),
  duration_min: 60,
  location_type: "incall" as "incall" | "outcall",
  location: "",
  price: "",
  deposit_paid: false,
  status: "geplant" as AppointmentStatus,
  notes: "",
});

export default function TerminePage() {
  const appts = useTable<Appointment>("appointments", {
    orderBy: "starts_at",
    ascending: true,
  });
  const contacts = useTable<Contact>("contacts");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);

  const contactName = (id: string | null) =>
    contacts.rows.find((c) => c.id === id)?.name;

  function openNew() {
    setEditId(null);
    setForm(empty());
    setOpen(true);
  }
  function openEdit(a: Appointment) {
    setEditId(a.id);
    setForm({
      title: a.title ?? "",
      contact_id: a.contact_id ?? "",
      starts_at: toLocalInput(a.starts_at),
      duration_min: a.duration_min,
      location_type: (a.location_type as "incall" | "outcall") ?? "incall",
      location: a.location ?? "",
      price: a.price != null ? String(a.price) : "",
      deposit_paid: a.deposit_paid,
      status: a.status,
      notes: a.notes ?? "",
    });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title: form.title || null,
      contact_id: form.contact_id || null,
      starts_at: new Date(form.starts_at).toISOString(),
      duration_min: Number(form.duration_min) || 60,
      location_type: form.location_type,
      location: form.location || null,
      price: form.price ? Number(form.price) : null,
      deposit_paid: form.deposit_paid,
      status: form.status,
      notes: form.notes || null,
    };
    try {
      if (editId) await appts.update(editId, payload);
      else await appts.insert(payload);
      setOpen(false);
    } catch (err) {
      alert(
        "Speichern fehlgeschlagen: " +
          (err instanceof Error ? err.message : "Unbekannter Fehler"),
      );
    } finally {
      setSaving(false);
    }
  }

  // Termin als erledigt markieren und als Einnahme verbuchen.
  // Gegen Doppelbuchung abgesichert: laufende Buchung sperrt Mehrfachklicks,
  // die Einnahme wird nur bei erfolgreichem Insert als "erledigt" markiert,
  // und 0-€-Buchungen werden abgelehnt.
  async function bookIncome(a: Appointment) {
    if (bookingId) return; // es läuft bereits eine Buchung
    if (a.status === "erledigt") return; // bereits verbucht
    const price = a.price ?? 0;
    if (!price || price <= 0) {
      alert("Für diesen Termin ist kein Preis (> 0 €) hinterlegt.");
      return;
    }
    setBookingId(a.id);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error: insErr } = await supabase.from("transactions").insert({
        user_id: user?.id,
        type: "einnahme",
        amount: price,
        category: "service",
        description: `Termin: ${a.title || contactName(a.contact_id) || "Buchung"}`,
        occurred_on: a.starts_at.slice(0, 10),
        appointment_id: a.id,
      });
      if (insErr) throw insErr;
      await appts.update(a.id, { status: "erledigt" });
    } catch (err) {
      alert(
        "Verbuchen fehlgeschlagen: " +
          (err instanceof Error ? err.message : "Unbekannter Fehler"),
      );
    } finally {
      setBookingId(null);
    }
  }

  async function removeAppt(id: string) {
    if (!confirm("Termin löschen?")) return;
    try {
      await appts.remove(id);
    } catch (err) {
      alert(
        "Löschen fehlgeschlagen: " +
          (err instanceof Error ? err.message : "Unbekannter Fehler"),
      );
    }
  }

  const now = Date.now();
  const upcoming = appts.rows.filter((a) => new Date(a.starts_at).getTime() >= now);
  const past = appts.rows
    .filter((a) => new Date(a.starts_at).getTime() < now)
    .reverse();

  return (
    <div>
      <PageHeader
        title="Termine"
        subtitle="Buchungen & Kalender"
        action={
          <button onClick={openNew} className="btn-primary !px-3" aria-label="Neu">
            <Plus size={18} />
          </button>
        }
      />

      <div className="space-y-5 px-4">
        {appts.loading && <p className="text-sm text-gray-400">Lädt…</p>}

        {!appts.loading && appts.rows.length === 0 && (
          <EmptyState
            icon={<CalendarDays size={40} />}
            title="Keine Termine"
            hint="Plane Buchungen mit Dauer, Ort und Anzahlung – und verbuche sie direkt als Einnahme."
          />
        )}

        {upcoming.length > 0 && (
          <Section title="Kommend">
            {upcoming.map((a) => (
              <ApptCard
                key={a.id}
                a={a}
                name={contactName(a.contact_id)}
                onEdit={() => openEdit(a)}
                onDelete={() => removeAppt(a.id)}
                onBook={() => bookIncome(a)}
                booking={bookingId === a.id}
              />
            ))}
          </Section>
        )}

        {past.length > 0 && (
          <Section title="Vergangen">
            {past.map((a) => (
              <ApptCard
                key={a.id}
                a={a}
                name={contactName(a.contact_id)}
                onEdit={() => openEdit(a)}
                onDelete={() => removeAppt(a.id)}
                onBook={() => bookIncome(a)}
                booking={bookingId === a.id}
              />
            ))}
          </Section>
        )}
      </div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? "Termin bearbeiten" : "Neuer Termin"}
      >
        <form onSubmit={save}>
          <Field label="Titel (optional)">
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </Field>
          <Field label="Kontakt">
            <select
              className="input"
              value={form.contact_id}
              onChange={(e) => setForm({ ...form, contact_id: e.target.value })}
            >
              <option value="">— keiner —</option>
              {contacts.rows.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Datum & Zeit">
              <input
                className="input"
                type="datetime-local"
                required
                value={form.starts_at}
                onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
              />
            </Field>
            <Field label="Dauer (Min.)">
              <input
                className="input"
                type="number"
                min={15}
                step={15}
                value={form.duration_min}
                onChange={(e) =>
                  setForm({ ...form, duration_min: Number(e.target.value) })
                }
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ort-Typ">
              <select
                className="input"
                value={form.location_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    location_type: e.target.value as "incall" | "outcall",
                  })
                }
              >
                <option value="incall">Incall</option>
                <option value="outcall">Outcall</option>
              </select>
            </Field>
            <Field label="Preis (€)">
              <input
                className="input"
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Ort / Adresse">
            <input
              className="input"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </Field>
          <Field label="Status">
            <select
              className="input"
              value={form.status}
              onChange={(e) =>
                setForm({ ...form, status: e.target.value as AppointmentStatus })
              }
            >
              {STATUS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <label className="mb-4 flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand"
              checked={form.deposit_paid}
              onChange={(e) =>
                setForm({ ...form, deposit_paid: e.target.checked })
              }
            />
            Anzahlung erhalten
          </label>
          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? "Speichert…" : "Speichern"}
          </button>
        </form>
      </Sheet>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-500">
        {title}
      </h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ApptCard({
  a,
  name,
  onEdit,
  onDelete,
  onBook,
  booking,
}: {
  a: Appointment;
  name?: string;
  onEdit: () => void;
  onDelete: () => void;
  onBook: () => void;
  booking?: boolean;
}) {
  const st = STATUS.find((s) => s.value === a.status)!;
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">
              {a.title || name || "Termin"}
            </h3>
            <StatusChip label={st.label} tone={st.tone} />
          </div>
          <p className="mt-0.5 text-sm text-gray-400">
            {dateTime(a.starts_at)} · {a.duration_min} Min
          </p>
          <p className="mt-0.5 flex items-center gap-2 text-sm text-gray-400">
            <MapPin size={12} />
            {a.location_type === "outcall" ? "Outcall" : "Incall"}
            {a.location ? ` · ${a.location}` : ""}
          </p>
          {name && a.title && (
            <p className="text-sm text-gray-500">Kontakt: {name}</p>
          )}
          <div className="mt-1 flex items-center gap-2">
            <span className="font-semibold text-brand-light">
              {euro(a.price)}
            </span>
            {a.deposit_paid && (
              <span className="inline-flex items-center gap-1 text-xs text-green-300">
                <BadgeCheck size={13} /> Anzahlung
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={onEdit}
            className="rounded-lg p-2 text-gray-400 hover:bg-surface-border"
            aria-label="Bearbeiten"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg p-2 text-gray-400 hover:bg-surface-border"
            aria-label="Löschen"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {a.status !== "erledigt" && a.price ? (
        <button
          onClick={onBook}
          disabled={booking}
          className="btn-ghost mt-3 w-full !py-1.5 text-xs disabled:opacity-50"
        >
          <CircleDollarSign size={14} />{" "}
          {booking ? "Verbucht…" : `Als Einnahme verbuchen (${euro(a.price)})`}
        </button>
      ) : null}
    </div>
  );
}
