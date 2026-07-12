-- ============================================================
-- Münz-Meister – Monetarisierung (Shop, Rewarded Loop, Käufe)
-- ------------------------------------------------------------
-- Aufbauend auf 0002_game.sql. Auch hier gilt: RLS erlaubt nur SELECT der
-- eigenen Zeilen; alle Gutschriften laufen serverseitig über den Service-
-- Role-Key. So bleibt die Ökonomie autoritativ.
-- ============================================================

-- ---------- BELOHNUNGS-LOG (Rewarded Loop / Ad + Kauf-Gutschriften) ----------
-- Dient als Nachweis für das Tages-Cap des Rewarded Loops und als Audit der
-- gewährten Gegenstände.
create table if not exists public.game_reward_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,                        -- reward | purchase
  product_id text,                           -- bei kind='purchase'
  coins bigint not null default 0,
  spins integer not null default 0,
  shields integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- KÄUFE (Audit + Idempotenz über provider_ref) ----------
create table if not exists public.game_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id text not null,
  provider text not null,                    -- stripe | google_play | apple | test
  provider_ref text,                         -- Transaktions-/Session-ID (idempotent)
  amount_cents integer not null,
  currency text not null default 'EUR',
  status text not null default 'granted' check (status in ('pending','granted','failed')),
  created_at timestamptz not null default now(),
  unique (provider, provider_ref)
);

-- ============================================================
-- ROW LEVEL SECURITY – nur eigene Zeilen lesen
-- ============================================================
alter table public.game_reward_log enable row level security;
alter table public.game_purchases  enable row level security;

create policy "own_select_game_reward_log" on public.game_reward_log
  for select using (auth.uid() = user_id);

create policy "own_select_game_purchases" on public.game_purchases
  for select using (auth.uid() = user_id);

-- Schreibzugriff nur über den Service-Role-Key in den Server-Routen.

-- ============================================================
-- INDIZES
-- ============================================================
create index if not exists idx_game_reward_log_user_time
  on public.game_reward_log (user_id, created_at);
create index if not exists idx_game_purchases_user
  on public.game_purchases (user_id, created_at);
