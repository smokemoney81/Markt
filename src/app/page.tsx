import Link from "next/link";
import {
  Sparkles,
  Coins,
  Zap,
  Shield,
  TrendingUp,
  Gift,
  ArrowRight,
  Users
} from "lucide-react";

export const metadata = {
  title: "Münz-Meister – Coin Master Klon",
  description: "Drehe das Glücksrad, sammle Münzen, baue dein Dorf auf und verdiene echte Belohnungen!",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-brand-dark text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur border-b border-slate-800 px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-2xl font-bold">
            <Coins className="text-brand-light" size={32} />
            <span>Münz-Meister</span>
          </div>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="px-5 py-2 rounded-lg border border-slate-700 hover:bg-slate-800 transition"
            >
              Anmelden
            </Link>
            <Link
              href="/login?signup=true"
              className="px-5 py-2 rounded-lg bg-brand text-white hover:bg-brand-light transition font-semibold"
            >
              Kostenlos spielen
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-24 pb-16 px-4 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-block mb-6 px-4 py-2 rounded-full bg-brand/20 border border-brand/50">
            <p className="text-sm font-semibold text-brand-light">🎮 Jetzt spielen – kostenlos!</p>
          </div>

          <h1 className="text-5xl md:text-6xl font-extrabold mb-6 leading-tight">
            Drehe das Rad,
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-light to-cyan-300">
              sammle Münzen
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
            Spiele das süchtig machende Coin Master Spiel, baue dein Dorf auf,
            verdiene Belohnungen und tritt gegen andere Spieler an!
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link
              href="/login?signup=true"
              className="px-8 py-4 bg-brand text-white rounded-xl font-bold text-lg hover:bg-brand-light transition flex items-center justify-center gap-2"
            >
              Kostenlos spielen <ArrowRight size={20} />
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 border-2 border-slate-700 text-white rounded-xl font-bold text-lg hover:bg-slate-800 transition"
            >
              Bereits Mitglied? Anmelden
            </Link>
          </div>

          <div className="flex justify-center gap-8 text-sm text-slate-400">
            <div className="flex items-center gap-2">
              <Users size={18} />
              <span>50.000+ Spieler</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp size={18} />
              <span>Täglich Belohnungen</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles size={18} />
              <span>100% Kostenlos</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-slate-900/50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12">Das Spiel</h2>

          <div className="grid md:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 hover:border-brand/50 transition">
              <div className="mb-4 inline-block p-3 rounded-lg bg-brand/20">
                <Sparkles className="text-brand-light" size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">Glücksrad drehen</h3>
              <p className="text-slate-400">
                Drehe das mystische Rad und gewinne Münzen, Energie, Schilde und mehr. Jede Drehung bringt Spannung!
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 hover:border-brand/50 transition">
              <div className="mb-4 inline-block p-3 rounded-lg bg-brand/20">
                <Coins className="text-brand-light" size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">Dorf aufbauen</h3>
              <p className="text-slate-400">
                Sammle Münzen und baue immer größere Gebäude. Jede Stufe schaltet neue Features frei!
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 hover:border-brand/50 transition">
              <div className="mb-4 inline-block p-3 rounded-lg bg-brand/20">
                <Zap className="text-brand-light" size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">Raid-Kämpfe</h3>
              <p className="text-slate-400">
                Greife andere Dörfer an, verdiene Münzen und baue dein Imperium auf. Strategie trifft Glück!
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 hover:border-brand/50 transition">
              <div className="mb-4 inline-block p-3 rounded-lg bg-brand/20">
                <Shield className="text-brand-light" size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">Wehr-System</h3>
              <p className="text-slate-400">
                Schütze dein Dorf mit Schilden vor Angriffen. Kombiniere Strategie mit Glück!
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 hover:border-brand/50 transition">
              <div className="mb-4 inline-block p-3 rounded-lg bg-brand/20">
                <Gift className="text-brand-light" size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">Tägliche Belohnungen</h3>
              <p className="text-slate-400">
                Komm täglich zurück für Bonus-Münzen, Freispiele und exklusive Rewards!
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 hover:border-brand/50 transition">
              <div className="mb-4 inline-block p-3 rounded-lg bg-brand/20">
                <Users className="text-brand-light" size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">Global spielen</h3>
              <p className="text-slate-400">
                Tritt weltweiten Bestenlisten bei, verdiene Erfolge und werde die Nummer 1!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-6">
            <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-brand-light mb-2">500M+</p>
              <p className="text-slate-400">Münzen verteilt</p>
            </div>
            <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-brand-light mb-2">100%</p>
              <p className="text-slate-400">Kostenlos spielbar</p>
            </div>
            <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-brand-light mb-2">24/7</p>
              <p className="text-slate-400">Verfügbar</p>
            </div>
            <div className="p-6 rounded-xl bg-slate-800/50 border border-slate-700 text-center">
              <p className="text-3xl font-bold text-brand-light mb-2">🚀</p>
              <p className="text-slate-400">Immer neue Updates</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-gradient-to-r from-brand to-brand-dark">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Bereit zu spielen?
          </h2>
          <p className="text-lg text-slate-200 mb-8 max-w-2xl mx-auto">
            Starten Sie kostenlos und sehen Sie selbst, warum Tausende von Spielern
            Münz-Meister lieben. Keine Kreditkarte erforderlich!
          </p>
          <Link
            href="/login?signup=true"
            className="inline-block px-10 py-4 bg-white text-brand rounded-xl font-bold text-lg hover:bg-slate-100 transition"
          >
            Jetzt kostenlos spielen
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 px-4 bg-slate-950">
        <div className="max-w-6xl mx-auto text-center text-slate-500 text-sm">
          <p>© 2026 Münz-Meister. Alle Rechte vorbehalten.</p>
          <div className="flex gap-6 justify-center mt-4">
            <Link href="/login" className="hover:text-slate-300">
              Datenschutz
            </Link>
            <Link href="/login" className="hover:text-slate-300">
              Nutzungsbedingungen
            </Link>
            <Link href="/login" className="hover:text-slate-300">
              Support
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
