import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-Role-Client – NUR serverseitig verwenden.
 *
 * Umgeht Row Level Security und darf daher niemals in eine Client-Component
 * importiert werden. Der Schlüssel (`SUPABASE_SERVICE_ROLE_KEY`) ist ein
 * Secret und wird NICHT mit `NEXT_PUBLIC_` ausgeliefert.
 *
 * Nutzung: autoritative Schreibzugriffe auf `game_state` / `game_spin_log`,
 * damit der Client den Spielstand nicht direkt manipulieren kann.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Spiel-Server nicht konfiguriert: NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY müssen gesetzt sein.",
    );
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
