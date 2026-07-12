-- ============================================================
-- Münz-Meister – Analytics (Aggregat über ALLE Spieler)
-- ------------------------------------------------------------
-- Liefert die zentralen Ökonomie-/Monetarisierungs-KPIs als JSON.
-- Aggregiert über alle Nutzer → nur für den Betreiber gedacht. Der Zugriff
-- wird in der App über eine Admin-Allowlist (GAME_ADMIN_EMAILS) abgesichert;
-- aufgerufen wird die Funktion mit dem Service-Role-Key.
-- ============================================================

create or replace function public.game_analytics()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'players_total',      (select count(*) from public.game_state),
    'players_active_1d',  (select count(*) from public.game_state where last_seen_at > now() - interval '1 day'),
    'players_active_7d',  (select count(*) from public.game_state where last_seen_at > now() - interval '7 days'),
    'players_active_30d', (select count(*) from public.game_state where last_seen_at > now() - interval '30 days'),
    'coins_circulating',  (select coalesce(sum(coins), 0) from public.game_state),
    'spins_played',       (select coalesce(sum(total_spins), 0) from public.game_state),
    'faucet_coins',       (select coalesce(sum(coin_amount), 0) from public.game_spin_log)
                          + (select coalesce(sum(coins), 0) from public.game_reward_log),
    'spin_outcomes',      (select coalesce(jsonb_object_agg(result_type, c), '{}'::jsonb)
                           from (select result_type, count(*) as c
                                 from public.game_spin_log group by result_type) t),
    'revenue_cents',      (select coalesce(sum(amount_cents), 0) from public.game_purchases where status = 'granted'),
    'purchases_count',    (select count(*) from public.game_purchases where status = 'granted'),
    'paying_users',       (select count(distinct user_id) from public.game_purchases where status = 'granted'),
    'reward_claims',      (select count(*) from public.game_reward_log where kind = 'reward'),
    'reward_coins',       (select coalesce(sum(coins), 0) from public.game_reward_log where kind = 'reward')
  );
$$;

-- Aufruf erfolgt ausschließlich über den Service-Role-Key.
grant execute on function public.game_analytics() to service_role;
