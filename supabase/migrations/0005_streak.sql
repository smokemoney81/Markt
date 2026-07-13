-- ============================================================
-- Münz-Meister – Streak-System für Tagesbonus
-- ------------------------------------------------------------
-- Wer täglich einen Tagesbonus abholt, sammelt einen Streak, der
-- den nächsten Bonus multipliziert (1x → 1,5x → 2x → 3x). Verpasst
-- man einen Tag (48h ohne Claim), fängt der Streak wieder bei 1 an.
--
-- Retention-Anker aus dem Konzept; passt strukturell zum bestehenden
-- Tagesbonus (`last_daily_at`), deshalb nur eine zusätzliche Spalte.
-- ============================================================
alter table public.game_state
  add column if not exists daily_streak integer not null default 0
  check (daily_streak >= 0);
