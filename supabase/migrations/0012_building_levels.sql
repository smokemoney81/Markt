-- ============================================================
-- Münz-Meister – Gebäude-Upgrade-System
-- ============================================================
-- Gebäude können jetzt bis Level 50 aufgewertet werden (statt
-- nur "gebaut" zu sein). Jedes Level kostet exponentiell mehr
-- und gewährt Boni auf Spin-Chancen und Münz-Output.
--
-- Format der Spalte (JSON):
--   { "<slot>": <level>, ... }  (Level 1-50)
--
-- Die Kosten sind 4x höher als im ursprünglichen System und
-- skalieren exponentiell mit jedem Level.
-- ============================================================

alter table public.game_state
  add column if not exists item_levels jsonb not null default '{}'::jsonb;
