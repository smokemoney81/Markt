import PageHeader from "@/components/PageHeader";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { computeAnalytics, isAdminEmail, type Analytics } from "@/lib/game/analytics";
import { fmt } from "@/lib/game/coinmaster";

export const dynamic = "force-dynamic";
export const metadata = { title: "Münz-Meister · Analytics" };

function euro(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function Info({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-4 mt-8 rounded-2xl border border-surface-border bg-surface-card p-5 text-center text-sm text-gray-300">
      <p className="font-semibold text-amber-300">{title}</p>
      <p className="mt-2 text-gray-400">{text}</p>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-card px-3 py-3">
      <div className="text-xs text-gray-400">{label}</div>
      <div className="mt-0.5 text-xl font-extrabold">{value}</div>
      {hint && <div className="text-[11px] text-gray-500">{hint}</div>}
    </div>
  );
}

export default async function AnalyticsPage() {
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <>
        <PageHeader title="Analytics" subtitle="Münz-Meister" />
        <Info
          title="Nicht konfiguriert"
          text="SUPABASE_SERVICE_ROLE_KEY fehlt oder die Migrationen (inkl. 0004_analytics.sql) sind nicht ausgeführt."
        />
      </>
    );
  }

  const auth = await createClient();
  const {
    data: { user },
  } = await auth.auth.getUser();

  if (!isAdminEmail(user?.email)) {
    return (
      <>
        <PageHeader title="Analytics" subtitle="Münz-Meister" />
        <Info
          title="Kein Zugriff"
          text="Diese Auswertung ist nur für Betreiber. Trage deine E-Mail in GAME_ADMIN_EMAILS ein, um sie zu sehen."
        />
      </>
    );
  }

  let data: Analytics;
  try {
    data = await computeAnalytics(createServiceClient());
  } catch {
    return (
      <>
        <PageHeader title="Analytics" subtitle="Münz-Meister" />
        <Info
          title="Fehler beim Laden"
          text="Konnte die Kennzahlen nicht berechnen. Ist die Migration 0004_analytics.sql ausgeführt?"
        />
      </>
    );
  }

  const outcomes = Object.entries(data.spin_outcomes).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <PageHeader title="Analytics" subtitle="Münz-Meister · alle Spieler" />
      <div className="space-y-6 px-4 pb-6">
        <section>
          <h2 className="mb-2 text-sm font-bold text-gray-300">💶 Monetarisierung</h2>
          <div className="grid grid-cols-2 gap-2">
            <Kpi label="Umsatz gesamt" value={euro(data.revenue_cents)} />
            <Kpi label="Käufe" value={`${data.purchases_count}`} />
            <Kpi label="Zahler" value={`${data.paying_users}`} hint={`${data.conversion_pct.toFixed(1)}% Conversion`} />
            <Kpi label="ARPPU" value={euro(data.arppu_cents)} hint={`ARPU ${euro(data.arpu_cents)}`} />
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold text-gray-300">👥 Spieler</h2>
          <div className="grid grid-cols-2 gap-2">
            <Kpi label="Spieler gesamt" value={`${data.players_total}`} />
            <Kpi label="Aktiv (24 h)" value={`${data.players_active_1d}`} />
            <Kpi label="Aktiv (7 T)" value={`${data.players_active_7d}`} />
            <Kpi label="Aktiv (30 T)" value={`${data.players_active_30d}`} />
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold text-gray-300">🪙 Ökonomie</h2>
          <div className="grid grid-cols-2 gap-2">
            <Kpi label="Münzen im Umlauf" value={fmt(data.coins_circulating)} />
            <Kpi label="Faucet (Quelle)" value={fmt(data.faucet_coins)} hint="Spins + Belohnungen" />
            <Kpi label="Spins gespielt" value={fmt(data.spins_played)} />
            <Kpi label="Reward-Abrufe" value={`${data.reward_claims}`} hint={`${fmt(data.reward_coins)} Münzen`} />
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-bold text-gray-300">🎰 Spin-Ergebnisse</h2>
          <div className="space-y-1.5">
            {outcomes.length === 0 && <p className="text-sm text-gray-500">Noch keine Spins.</p>}
            {outcomes.map(([type, count]) => (
              <div key={type} className="flex items-center justify-between rounded-lg border border-surface-border bg-surface-card px-3 py-2 text-sm">
                <span className="text-gray-300">{type}</span>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </section>

        <p className="text-center text-[11px] text-gray-600">
          Aggregat über alle Spieler · nur für Betreiber sichtbar
        </p>
      </div>
    </>
  );
}
