-- ============================================================
-- Münz-Meister – Phasen 5–16 (Social, Season, VIP, Progression)
-- ------------------------------------------------------------
-- HINWEIS: Diese Migration wurde direkt am Live-Projekt angewandt, bevor sie
-- im Repo lag (Branch-Divergenz, siehe CLAUDE.md). Sie ist hier aus dem
-- tatsächlichen Datenbank-Schema rekonstruiert, damit `supabase/migrations`
-- die produktive DB wieder vollständig reproduziert. Alles ist mit
-- `if not exists` abgesichert und daher gefahrlos wiederholbar.
--
-- WICHTIG: Row Level Security für die hier angelegten Tabellen kommt in
-- 0008_rls_social.sql – ohne die läuft man in die „RLS disabled"-Warnung.
-- ============================================================

-- ---------- Erweiterungen an game_state (Progression/VIP/Season/Social) ----------

alter table public.game_state
  add column if not exists battle_pass_level integer default 0,
  add column if not exists battle_pass_xp integer default 0,
  add column if not exists clan_id varchar default null,
  add column if not exists weekly_challenge_bits integer default 0,
  add column if not exists last_weekly_challenge_reset timestamp default now(),
  add column if not exists achievement_bits integer default 0,
  add column if not exists current_season_id varchar default 'spring',
  add column if not exists season_progress integer default 0,
  add column if not exists selected_theme varchar default 'default',
  add column if not exists wheel_upgrades jsonb default '{}'::jsonb,
  add column if not exists daily_quest_bits integer default 0,
  add column if not exists last_daily_quest_reset timestamp default now(),
  add column if not exists vip_tier integer default 0,
  add column if not exists vip_expire_at timestamp,
  add column if not exists friend_ids text[] default '{}'::text[];

-- ---------- Clans ----------

create table if not exists public.clans (
  id           varchar primary key default (gen_random_uuid())::text,
  name         varchar not null,
  leader_id    uuid not null references auth.users(id),
  member_count integer default 1,
  created_at   timestamp default now(),
  updated_at   timestamp default now()
);

create table if not exists public.clan_members (
  user_id   uuid not null references auth.users(id),
  clan_id   varchar not null references public.clans(id),
  joined_at timestamp default now(),
  primary key (user_id, clan_id)
);

-- ---------- Bestenlisten ----------

create table if not exists public.leaderboards (
  id           serial primary key,
  user_id      uuid not null references auth.users(id),
  rank         integer,
  score        integer,
  coins_earned integer default 0,
  period       varchar default 'global',
  updated_at   timestamp default now()
);

-- ---------- Achievements ----------

create table if not exists public.achievement_log (
  id             serial primary key,
  user_id        uuid not null references auth.users(id),
  achievement_id varchar,
  unlocked_at    timestamp default now()
);

-- ---------- Season-Fortschritt ----------

create table if not exists public.seasonal_progress (
  user_id         uuid not null references auth.users(id),
  season_id       varchar not null,
  progress        integer default 0,
  rewards_claimed integer default 0,
  primary key (user_id, season_id)
);

-- ---------- VIP ----------

create table if not exists public.vip_logs (
  id           serial primary key,
  user_id      uuid not null references auth.users(id),
  tier         integer,
  purchased_at timestamp default now(),
  expire_at    timestamp not null
);

-- ---------- Freundschaften ----------

create table if not exists public.friendships (
  user_id    uuid not null references auth.users(id),
  friend_id  uuid not null references auth.users(id),
  created_at timestamp default now(),
  primary key (user_id, friend_id)
);

-- ---------- Geschenke ----------

create table if not exists public.gifts (
  id           serial primary key,
  sender_id    uuid not null references auth.users(id),
  recipient_id uuid not null references auth.users(id),
  coins        integer default 0,
  spins        integer default 0,
  sent_at      timestamp default now(),
  claimed_at   timestamp
);
