"use client";

import { useMemo, useState } from "react";
import { useTable } from "@/lib/useTable";
import { euro, dateShort } from "@/lib/format";
import type { Transaction, TransactionType } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import { Sheet, Field, EmptyState } from "@/components/ui";
import {
  Plus,
  Wallet,
  Trash2,
  ArrowDownLeft,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const CATS_IN = ["service", "trinkgeld", "sonstig"];
const CATS_OUT = ["anzeige", "hotel", "anfahrt", "outfit", "gesundheit", "sonstig"];

const empty = () => ({
  type: "einnahme" as TransactionType,
  amount: "",
  category: "service",
  description: "",
  occurred_on: new Date().toISOString().slice(0, 10),
});

export default function FinanzenPage() {
  const { rows, loading, insert, remove } = useTable<Transaction>(
    "transactions",
    { orderBy: "occurred_on", ascending: false },
  );
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);

  const ref = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + monthOffset, 1);
  }, [monthOffset]);

  const monthRows = rows.filter((t) => {
    const d = new Date(t.occurred_on);
    return (
      d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()
    );
  });

  const income = monthRows
    .filter((t) => t.type === "einnahme")
    .reduce((s, t) => s + Number(t.amount), 0);
  const expense = monthRows
    .filter((t) => t.type === "ausgabe")
    .reduce((s, t) => s + Number(t.amount), 0);

  function openNew() {
    setForm(empty());
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await insert({
        type: form.type,
        amount: Number(form.amount),
        category: form.category || null,
        description: form.description || null,
        occurred_on: form.occurred_on,
      });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const monthLabel = ref.toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      <PageHeader
        title="Finanzen"
        subtitle="Einnahmen & Ausgaben"
        action={
          <button onClick={openNew} className="btn-primary !px-3" aria-label="Neu">
            <Plus size={18} />
          </button>
        }
      />

      <div className="space-y-4 px-4">
        {/* Monats-Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setMonthOffset((m) => m - 1)}
            className="rounded-lg p-2 text-gray-400 hover:bg-surface-border"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="font-semibold capitalize">{monthLabel}</span>
          <button
            onClick={() => setMonthOffset((m) => Math.min(0, m + 1))}
            disabled={monthOffset >= 0}
            className="rounded-lg p-2 text-gray-400 hover:bg-surface-border disabled:opacity-30"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Übersicht */}
        <div className="card bg-gradient-to-br from-brand-dark to-surface-card">
          <p className="text-sm text-pink-100">Gewinn</p>
          <p className="text-3xl font-extrabold">{euro(income - expense)}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-black/20 p-3">
              <p className="flex items-center gap-1 text-emerald-300">
                <ArrowDownLeft size={14} /> Einnahmen
              </p>
              <p className="text-lg font-bold">{euro(income)}</p>
            </div>
            <div className="rounded-xl bg-black/20 p-3">
              <p className="flex items-center gap-1 text-rose-300">
                <ArrowUpRight size={14} /> Ausgaben
              </p>
              <p className="text-lg font-bold">{euro(expense)}</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-pink-100/60">
            Tipp: für die Steuererklärung relevant – Einnahmen & Ausgaben sauber
            erfassen.
          </p>
        </div>

        {/* Liste */}
        {loading && <p className="text-sm text-gray-400">Lädt…</p>}
        {!loading && monthRows.length === 0 && (
          <EmptyState
            icon={<Wallet size={40} />}
            title="Keine Buchungen in diesem Monat"
            hint="Erfasse Einnahmen aus Terminen sowie Ausgaben wie Anzeigenkosten."
          />
        )}

        <div className="space-y-2">
          {monthRows.map((t) => {
            const inc = t.type === "einnahme";
            return (
              <div key={t.id} className="card flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                    inc
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-rose-500/15 text-rose-300"
                  }`}
                >
                  {inc ? (
                    <ArrowDownLeft size={18} />
                  ) : (
                    <ArrowUpRight size={18} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {t.description || t.category || (inc ? "Einnahme" : "Ausgabe")}
                  </p>
                  <p className="text-xs text-gray-400">
                    {dateShort(t.occurred_on)}
                    {t.category ? ` · ${t.category}` : ""}
                  </p>
                </div>
                <span
                  className={`font-bold ${
                    inc ? "text-emerald-300" : "text-rose-300"
                  }`}
                >
                  {inc ? "+" : "−"} {euro(Number(t.amount))}
                </span>
                <button
                  onClick={() => confirm("Buchung löschen?") && remove(t.id)}
                  className="rounded-lg p-1.5 text-gray-500 hover:bg-surface-border"
                  aria-label="Löschen"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Neue Buchung">
        <form onSubmit={save}>
          <div className="mb-3 grid grid-cols-2 gap-2">
            {(["einnahme", "ausgabe"] as TransactionType[]).map((tp) => (
              <button
                key={tp}
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    type: tp,
                    category: tp === "einnahme" ? "service" : "anzeige",
                  })
                }
                className={`btn ${
                  form.type === tp
                    ? tp === "einnahme"
                      ? "bg-emerald-600 text-white"
                      : "bg-rose-600 text-white"
                    : "btn-ghost"
                }`}
              >
                {tp === "einnahme" ? "Einnahme" : "Ausgabe"}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Betrag (€)">
              <input
                className="input"
                type="number"
                step="0.01"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label="Datum">
              <input
                className="input"
                type="date"
                value={form.occurred_on}
                onChange={(e) =>
                  setForm({ ...form, occurred_on: e.target.value })
                }
              />
            </Field>
          </div>
          <Field label="Kategorie">
            <select
              className="input"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {(form.type === "einnahme" ? CATS_IN : CATS_OUT).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Beschreibung">
            <input
              className="input"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
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
