-- ============================================================
-- Münz-Meister – Nebenläufigkeit härten (Lost-Update-Schutz)
-- ------------------------------------------------------------
-- Bisher waren alle Spielaktionen read-modify-write ohne
-- Serialisierung: `persistState` überschrieb die Zeile blind. Zwei
-- parallele Requests konnten so Coins/Spins duplizieren, das
-- Rewarded-Tageslimit umgehen, Einmal-Produkte doppelt gutschreiben
-- und den Tagesbonus doppelt einlösen.
--
-- Diese Migration legt das DB-seitige Fundament:
--   1. game_state.version für optimistisches Locking (Version-Guard).
--   2. Idempotenz der Käufe auch bei NULL provider_ref.
--   3. Partieller Unique-Index gegen Doppel-Gutschrift von
--      Einmal-Produkten.
-- Die Spiellogik bleibt unverändert in coinmaster.ts (single source
-- of truth) – hier werden nur Persistenz/Constraints atomar gemacht.
-- ============================================================

-- ---------- 1. Optimistisches Locking ----------
-- Jede autoritative Schreiboperation setzt version = version + 1 und
-- verlangt beim UPDATE die zuvor gelesene Version. Trifft ein zweiter
-- (paralleler) Request eine bereits erhöhte Version, schreibt sein
-- UPDATE 0 Zeilen → Konflikt, der serverseitig neu geladen und erneut
-- angewendet wird (Retry).
alter table public.game_state
  add column if not exists version bigint not null default 0;

-- ---------- 2. Idempotenz der Käufe härten ----------
-- Das ursprüngliche `unique (provider, provider_ref)` greift nicht,
-- wenn provider_ref NULL ist (NULLs gelten in Postgres als distinct) –
-- ein Webhook-Retail könnte doppelt gutschreiben. Wir ersetzen den
-- Constraint durch einen Unique-Index mit `nulls not distinct`, sodass
-- auch zwei NULL-Referenzen kollidieren.
alter table public.game_purchases
  drop constraint if exists game_purchases_provider_provider_ref_key;
create unique index if not exists idx_game_purchases_provider_ref
  on public.game_purchases (provider, provider_ref) nulls not distinct;

-- ---------- 3. Einmal-Produkte gegen Doppel-Gutschrift ----------
-- DB-seitiger Schutz: pro Nutzer darf ein Einmal-Produkt nur einmal den
-- Status 'granted' haben. Partieller Unique-Index über die once-Produkte
-- des Katalogs (aktuell nur 'starter_pack'). WICHTIG: Neue Einmal-
-- Produkte (SHOP_PRODUCTS mit once: true) hier ergänzen.
create unique index if not exists idx_game_purchases_once_granted
  on public.game_purchases (user_id, product_id)
  where status = 'granted' and product_id in ('starter_pack');
