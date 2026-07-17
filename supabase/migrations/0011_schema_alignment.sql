-- ============================================================
-- Schema-Angleichung: 0007-Tabellen konsistent machen + fehlende Indizes
-- ------------------------------------------------------------
-- HINWEIS ZUR IMPLEMENTIERUNGSTIEFE: Die in 0007 angelegten Tabellen der
-- Phasen 5–16 (Clans, Bestenlisten, Achievements, Season, VIP, Freunde,
-- Geschenke) sind aktuell „nur Schema" – es gibt noch KEINE App-Logik,
-- die sie beschreibt/liest. Sie existieren, um das produktive DB-Schema
-- vollständig zu reproduzieren (siehe 0007). Diese Migration gleicht die
-- bekannten Inkonsistenzen an, ohne Spiellogik hinzuzufügen:
--
--   1. Fremdschlüssel auf auth.users bekommen ON DELETE CASCADE (sonst
--      bleiben beim Löschen eines Nutzers verwaiste Zeilen zurück bzw. das
--      Löschen schlägt fehl).
--   2. `timestamp` → `timestamptz` (Konsistenz zum restlichen Schema, das
--      durchgängig timestamptz nutzt; sonst Zeitzonen-Mehrdeutigkeit).
--   3. Fehlende Indizes auf den FK-/Lookup-Spalten.
--   4. Bonus: Wertebereichs-Check für contacts.rating (0..5).
--
-- Alles idempotent (drop constraint if exists / if not exists).
-- ============================================================

-- ---------- 1. FK ON DELETE CASCADE ----------
alter table public.clans
  drop constraint if exists clans_leader_id_fkey,
  add constraint clans_leader_id_fkey
    foreign key (leader_id) references auth.users(id) on delete cascade;

alter table public.clan_members
  drop constraint if exists clan_members_user_id_fkey,
  add constraint clan_members_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade,
  drop constraint if exists clan_members_clan_id_fkey,
  add constraint clan_members_clan_id_fkey
    foreign key (clan_id) references public.clans(id) on delete cascade;

alter table public.leaderboards
  drop constraint if exists leaderboards_user_id_fkey,
  add constraint leaderboards_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.achievement_log
  drop constraint if exists achievement_log_user_id_fkey,
  add constraint achievement_log_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.seasonal_progress
  drop constraint if exists seasonal_progress_user_id_fkey,
  add constraint seasonal_progress_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.vip_logs
  drop constraint if exists vip_logs_user_id_fkey,
  add constraint vip_logs_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;

alter table public.friendships
  drop constraint if exists friendships_user_id_fkey,
  add constraint friendships_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade,
  drop constraint if exists friendships_friend_id_fkey,
  add constraint friendships_friend_id_fkey
    foreign key (friend_id) references auth.users(id) on delete cascade;

alter table public.gifts
  drop constraint if exists gifts_sender_id_fkey,
  add constraint gifts_sender_id_fkey
    foreign key (sender_id) references auth.users(id) on delete cascade,
  drop constraint if exists gifts_recipient_id_fkey,
  add constraint gifts_recipient_id_fkey
    foreign key (recipient_id) references auth.users(id) on delete cascade;

-- ---------- 2. timestamp → timestamptz ----------
alter table public.game_state
  alter column last_weekly_challenge_reset type timestamptz using last_weekly_challenge_reset at time zone 'UTC',
  alter column last_daily_quest_reset type timestamptz using last_daily_quest_reset at time zone 'UTC',
  alter column vip_expire_at type timestamptz using vip_expire_at at time zone 'UTC';

alter table public.clans
  alter column created_at type timestamptz using created_at at time zone 'UTC',
  alter column updated_at type timestamptz using updated_at at time zone 'UTC';

alter table public.clan_members
  alter column joined_at type timestamptz using joined_at at time zone 'UTC';

alter table public.leaderboards
  alter column updated_at type timestamptz using updated_at at time zone 'UTC';

alter table public.achievement_log
  alter column unlocked_at type timestamptz using unlocked_at at time zone 'UTC';

alter table public.vip_logs
  alter column purchased_at type timestamptz using purchased_at at time zone 'UTC',
  alter column expire_at type timestamptz using expire_at at time zone 'UTC';

alter table public.friendships
  alter column created_at type timestamptz using created_at at time zone 'UTC';

alter table public.gifts
  alter column sent_at type timestamptz using sent_at at time zone 'UTC',
  alter column claimed_at type timestamptz using claimed_at at time zone 'UTC';

-- ---------- 3. Fehlende Indizes ----------
create index if not exists idx_clan_members_clan_id   on public.clan_members (clan_id);
create index if not exists idx_gifts_recipient_id     on public.gifts (recipient_id);
create index if not exists idx_gifts_sender_id        on public.gifts (sender_id);
create index if not exists idx_friendships_friend_id  on public.friendships (friend_id);
create index if not exists idx_leaderboards_user_id   on public.leaderboards (user_id);
create index if not exists idx_achievement_log_user_id on public.achievement_log (user_id);
create index if not exists idx_vip_logs_user_id       on public.vip_logs (user_id);

-- ---------- 4. contacts.rating Wertebereich absichern ----------
alter table public.contacts
  drop constraint if exists contacts_rating_range,
  add constraint contacts_rating_range
    check (rating is null or rating between 0 and 5);
