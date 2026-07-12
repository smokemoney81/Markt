-- ============================================================
-- Münz-Meister – Serverautoritative Spiel-Ökonomie
-- ------------------------------------------------------------
-- Der bisherige Spielstand lag nur im localStorage (Client) und
-- war damit trivial manipulierbar → keine Grundlage für F2P-
-- Monetarisierung. Diese Migration verlagert den Spielstand auf
-- den Server.
--
-- WICHTIG: RLS erlaubt Spielern nur SELECT auf die eigene Zeile.
-- Es gibt bewusst KEINE insert/update/delete-Policies für Nutzer.
-- Alle Mutationen laufen ausschließlich über die Server-Routen
-- (Next.js Route Handler mit Service-Role-Key), die RNG und Coin-
-- Mathematik autoritativ ausführen. So kann der Client den Kontostand
-- nicht direkt schreiben.
-- ============================================================

-- ---------- SPIELSTAND (eine Zeile pro Nutzer) ----------
create table if not exists public.game_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  coins bigint not null default 25000 check (coins >= 0),
  spins integer not null default 50 check (spins >= 0),
  shields integer not null default 1 check (shields between 0 and 3),
  stars integer not null default 0,
  bet integer not null default 1,
  village_index integer not null default 0,
  -- Zustand der 5 Dorf-Objekte: ["none"|"built"|"damaged", ...]
  items jsonb not null default '["none","none","none","none","none"]'::jsonb,
  -- Karten-Besitz: { cardId: Anzahl }
  cards jsonb not null default '{}'::jsonb,
  -- Bereits eingelöste (komplette) Sets
  completed_sets jsonb not null default '[]'::jsonb,
  last_regen_at timestamptz not null default now(),
  last_daily_at timestamptz,                 -- null = noch nie
  last_seen_at timestamptz not null default now(),
  total_spins integer not null default 0,
  attacks_won integer not null default 0,
  raids_won integer not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------- SPIN-LOG (Faucet-Nachweis & Anti-Cheat-Basis) ----------
create table if not exists public.game_spin_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  result_type text not null,                 -- coins | jackpot | energy | shield | attack | raid | nothing
  coin_amount bigint not null default 0,
  bet integer not null default 1,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY – nur Lesen der eigenen Daten
-- ============================================================
alter table public.game_state    enable row level security;
alter table public.game_spin_log enable row level security;

create policy "own_select_game_state" on public.game_state
  for select using (auth.uid() = user_id);

create policy "own_select_game_spin_log" on public.game_spin_log
  for select using (auth.uid() = user_id);

-- Bewusst KEINE insert/update/delete-Policies: Schreibzugriff nur über
-- den Service-Role-Key in den Server-Routen (umgeht RLS autoritativ).

-- ============================================================
-- INDIZES
-- ============================================================
create index if not exists idx_game_spin_log_user_time
  on public.game_spin_log (user_id, created_at);
