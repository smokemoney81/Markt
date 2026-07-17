-- ============================================================
-- Münz-Meister – RLS für die sozialen/Phase-5–16-Tabellen
-- ------------------------------------------------------------
-- Die Tabellen aus 0007_phases_5_16 (Clans, Bestenlisten, Achievements,
-- Season, VIP, Freundschaften, Geschenke) wurden ohne Row Level Security
-- angelegt und waren damit über den öffentlichen anon-Key voll les- UND
-- schreibbar. Das schließen wir hier.
--
-- Muster wie beim übrigen Spiel (serverautoritativ, siehe 0002_game.sql):
--   * RLS an, Spieler dürfen NUR SELECT (die für sie relevanten Zeilen).
--   * KEINE insert/update/delete-Policies – alle Mutationen laufen über die
--     API-Routen mit dem Service-Role-Key (umgeht RLS autoritativ).
--
-- Lese-Sichtbarkeit je Tabelle:
--   * Öffentlich/sozial (Clans, Clan-Mitglieder, Bestenlisten): alle
--     eingeloggten Spieler dürfen lesen (Browsen/Ranglisten).
--   * Privat (Achievements, Season-Fortschritt, VIP): nur die eigene Zeile.
--   * Beziehungen (Freundschaften, Geschenke): beide beteiligten Seiten.
--
-- drop-if-exists vor jedem create policy macht die Migration wiederholbar.
-- ============================================================

alter table public.clans             enable row level security;
alter table public.clan_members      enable row level security;
alter table public.leaderboards      enable row level security;
alter table public.achievement_log   enable row level security;
alter table public.seasonal_progress enable row level security;
alter table public.vip_logs          enable row level security;
alter table public.friendships       enable row level security;
alter table public.gifts             enable row level security;

-- ---------- Öffentlich/sozial: alle Eingeloggten dürfen lesen ----------

drop policy if exists "clans_select_authenticated" on public.clans;
create policy "clans_select_authenticated" on public.clans
  for select to authenticated using (true);

drop policy if exists "clan_members_select_authenticated" on public.clan_members;
create policy "clan_members_select_authenticated" on public.clan_members
  for select to authenticated using (true);

drop policy if exists "leaderboards_select_authenticated" on public.leaderboards;
create policy "leaderboards_select_authenticated" on public.leaderboards
  for select to authenticated using (true);

-- ---------- Privat: nur die eigene Zeile ----------

drop policy if exists "achievement_log_select_own" on public.achievement_log;
create policy "achievement_log_select_own" on public.achievement_log
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "seasonal_progress_select_own" on public.seasonal_progress;
create policy "seasonal_progress_select_own" on public.seasonal_progress
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "vip_logs_select_own" on public.vip_logs;
create policy "vip_logs_select_own" on public.vip_logs
  for select to authenticated using (auth.uid() = user_id);

-- ---------- Beziehungen: beide beteiligten Seiten ----------

drop policy if exists "friendships_select_own" on public.friendships;
create policy "friendships_select_own" on public.friendships
  for select to authenticated using (auth.uid() = user_id or auth.uid() = friend_id);

drop policy if exists "gifts_select_own" on public.gifts;
create policy "gifts_select_own" on public.gifts
  for select to authenticated using (auth.uid() = sender_id or auth.uid() = recipient_id);
