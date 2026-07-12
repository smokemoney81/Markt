"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTable } from "@/lib/useTable";
import { euro, dateTime, bumpDue } from "@/lib/format";
import type { Ad, Appointment, Contact, Transaction } from "@/lib/types";
import {
  Megaphone,
  Users,
  CalendarDays,
  Wallet,
  LogOut,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const ads = useTable<Ad>("ads");
  const contacts = useTable<Contact>("contacts");
  const appts = useTable<Appointment>("appointments", {
    orderBy: "starts_at",
    ascending: true,
  });
  const tx = useTable<Transaction>("transactions");

  async function logout() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const monthTx = tx.rows.filter((t) => new Date(t.occurred_on) >= monthStart);
  const income = monthTx
    .filter((t) => t.type === "einnahme")
    .reduce((s, t) => s + Number(t.amount), 0);
  const expense = monthTx
    .filter((t) => t.type === "ausgabe")
    .reduce((s, t) => s + Number(t.amount), 0);

  const dueAds = ads.rows.filter(
    (a) =>
      a.status === "aktiv" &&
      bumpDue(a.last_bumped_at, a.bump_interval_hours).overdue,
  );

  const upcoming = appts.rows
    .filter(
      (a) =>
        new Date(a.starts_at) >= new Date(Date.now() - 3600 * 1000) &&
        a.status !== "abgesagt" &&
        a.status !== "no_show",
    )
    .slice(0, 4);

  const stammkunden = contacts.rows.filter(
    (c) => c.status === "stammkunde",
  ).length;
  const blacklisted = contacts.rows.filter(
    (c) => c.status === "blacklist",
  ).length;

  return (
    <div>
      <header className="safe-top flex items-center justify-between px-4 pb-2 pt-5">
        <div>
          <p className="text-sm text-gray-400">Willkommen zurück 💗</p>
          <h1 className="text-2xl font-extrabold tracking-tight">Dashboard</h1>
        </div>
        <button
          onClick={logout}
          className="rounded-full border border-surface-border p-2.5 text-gray-300 hover:bg-surface-border"
          aria-label="Abmelden"
        >
          <LogOut size={18} />
        </button>
      </header>

      <div className="space-y-4 px-4">
        {/* Umsatz-Karte */}
        <div className="card bg-gradient-to-br from-brand-dark to-surface-card">
          <div className="flex items-center gap-2 text-sm text-cyan-100">
            <TrendingUp size={16} /> Diesen Monat
          </div>
          <div className="mt-1 text-3xl font-extrabold">
            {euro(income - expense)}
          </div>
          <div className="mt-1 flex gap-4 text-sm">
            <span className="text-green-300">+ {euro(income)} Einnahmen</span>
            <span className="text-red-300">− {euro(expense)} Ausgaben</span>
          </div>
        </div>

        {/* Warnung: fällige Bumps */}
        {dueAds.length > 0 && (
          <Link
            href="/anzeigen"
            className="flex items-center gap-3 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4"
          >
            <AlertTriangle className="text-yellow-300" size={22} />
            <div className="flex-1">
              <p className="font-semibold text-yellow-200">
                {dueAds.length} Anzeige{dueAds.length > 1 ? "n" : ""} fällig
              </p>
              <p className="text-sm text-yellow-200/70">
                Jetzt „nach oben schieben"
              </p>
            </div>
            <ChevronRight className="text-yellow-300" size={20} />
          </Link>
        )}

        {/* Schnell-Statistik */}
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            href="/anzeigen"
            icon={<Megaphone size={18} />}
            label="Aktive Anzeigen"
            value={ads.rows.filter((a) => a.status === "aktiv").length}
          />
          <StatTile
            href="/kontakte"
            icon={<Users size={18} />}
            label="Kontakte"
            value={contacts.rows.length}
            hint={`${stammkunden} Stamm · ${blacklisted} Blacklist`}
          />
          <StatTile
            href="/termine"
            icon={<CalendarDays size={18} />}
            label="Kommende Termine"
            value={upcoming.length}
          />
          <StatTile
            href="/finanzen"
            icon={<Wallet size={18} />}
            label="Buchungen (Monat)"
            value={monthTx.length}
          />
        </div>

        {/* Kommende Termine */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-bold">Nächste Termine</h2>
            <Link href="/termine" className="text-sm text-brand-light">
              Alle
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="card text-sm text-gray-400">
              Keine kommenden Termine.
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map((a) => (
                <Link
                  key={a.id}
                  href="/termine"
                  className="card flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {a.title || "Termin"}
                    </p>
                    <p className="text-sm text-gray-400">
                      {dateTime(a.starts_at)} · {a.duration_min} Min
                    </p>
                  </div>
                  <span className="font-semibold text-brand-light">
                    {euro(a.price)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatTile({
  href,
  icon,
  label,
  value,
  hint,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <Link href={href} className="card">
      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-brand/15 text-brand-light">
        {icon}
      </div>
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
      {hint && <div className="mt-0.5 text-[11px] text-gray-500">{hint}</div>}
    </Link>
  );
}
