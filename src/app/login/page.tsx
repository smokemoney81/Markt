"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Heart, Loader2 } from "lucide-react";

const configured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    const supabase = createClient();
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMsg("Konto erstellt. Falls nötig E-Mail bestätigen, dann einloggen.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        router.replace("/");
        router.refresh();
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Fehler beim Anmelden.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand">
          <Heart size={32} className="text-white" fill="white" />
        </div>
        <h1 className="text-2xl font-extrabold">Markt Dashboard</h1>
        <p className="mt-1 text-sm text-gray-400">
          Anzeigen · Kontakte · Termine · Finanzen · Medien
        </p>
      </div>

      {!configured ? (
        <div className="card text-sm text-gray-300">
          <p className="font-semibold text-amber-300">Setup nötig</p>
          <p className="mt-2">
            Lege die Umgebungsvariablen <code>NEXT_PUBLIC_SUPABASE_URL</code> und{" "}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> an (siehe{" "}
            <code>.env.example</code> und <code>README.md</code>).
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="card space-y-3">
          <div>
            <label className="label">E-Mail</label>
            <input
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label">Passwort</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </div>

          {msg && <p className="text-sm text-amber-300">{msg}</p>}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading && <Loader2 size={16} className="animate-spin" />}
            {mode === "login" ? "Einloggen" : "Konto erstellen"}
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="w-full text-center text-sm text-gray-400 hover:text-gray-200"
          >
            {mode === "login"
              ? "Noch kein Konto? Registrieren"
              : "Schon ein Konto? Einloggen"}
          </button>
        </form>
      )}
    </main>
  );
}
