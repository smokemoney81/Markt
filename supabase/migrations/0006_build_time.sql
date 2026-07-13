-- ============================================================
-- Münz-Meister – Bauzeit-Mechanik
-- ------------------------------------------------------------
-- Bauten sind nicht mehr instant: nach dem Klick auf "Bauen"
-- startet ein Timer (item_builds[slot].doneAt), und das Objekt
-- wird erst nach Ablauf serverseitig als "built" markiert. Das
-- verlangsamt das späte Grind-Gefühl, gibt dem Idle-Charakter
-- des Spiels aber mehr Struktur und Wiederkehr-Anreize.
--
-- Format der Spalte (JSON):
--   { "<slot>": { "doneAt": <ISO-Timestamp>, "repair": <bool> }, ... }
--
-- Fertigstellung passiert autoritativ in `applyBuildProgress`
-- (Server) – der Client zeigt nur den laufenden Countdown.
-- ============================================================

alter table public.game_state
  add column if not exists item_builds jsonb not null default '{}'::jsonb;
