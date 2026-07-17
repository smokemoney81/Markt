-- ============================================================
-- Münz-Meister – Analytics-Korrektur: Faucet nur echte Belohnungen
-- ------------------------------------------------------------
-- Bisher zählte `faucet_coins` alle Zeilen aus game_reward_log mit –
-- also auch Kauf-Gutschriften (kind='purchase'). Bezahlte Münzen sind
-- aber kein Faucet (kostenlos ausgeschütteter Zufluss), sondern Umsatz.
-- Diese Migration ersetzt die Funktion, sodass der Reward-Anteil des
-- Faucets auf kind='reward' gefiltert wird. Alle übrigen KPIs bleiben
-- unverändert.
-- ============================================================

create or replace function public.game_analytics()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'players_total',      (select count(*) from public.game_state),
    'players_active_1d',  (select count(*) from public.game_state where last_seen_at > now() - interval '1 day'),
    'players_active_7d',  (select count(*) from public.game_state where last_seen_at > now() - interval '7 days'),
    'players_active_30d', (select count(*) from public.game_state where last_seen_at > now() - interval '30 days'),
    'coins_circulating',  (select coalesce(sum(coins), 0) from public.game_state),
    'spins_played',       (select coalesce(sum(total_spins), 0) from public.game_state),
    -- Faucet = Spin-Ausschüttung + kostenlose Rewarded-Loop-Belohnungen.
    -- Käufe (kind='purchase') sind Umsatz, kein Faucet → hier ausgeschlossen.
    'faucet_coins',       (select coalesce(sum(coin_amount), 0) from public.game_spin_log)
                          + (select coalesce(sum(coins), 0) from public.game_reward_log where kind = 'reward'),
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

grant execute on function public.game_analytics() to service_role;
