-- Migration: Alle Phasen 5–16 für Münz-Meister
-- Phase 5: Battle Pass
-- Phase 6: Clans
-- Phase 8: Weekly Challenges
-- Phase 9: Achievements
-- Phase 10: Seasonal Events
-- Phase 11: Cosmetics
-- Phase 13: Wheel Upgrades
-- Phase 14: Daily Quests
-- Phase 15: VIP
-- Phase 16: Social

ALTER TABLE game_state ADD COLUMN IF NOT EXISTS battle_pass_level INT DEFAULT 0;
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS battle_pass_xp INT DEFAULT 0;
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS clan_id VARCHAR(50) DEFAULT NULL;
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS weekly_challenge_bits INT DEFAULT 0;
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS last_weekly_challenge_reset TIMESTAMP DEFAULT now();
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS achievement_bits INT DEFAULT 0;
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS current_season_id VARCHAR(20) DEFAULT 'spring';
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS season_progress INT DEFAULT 0;
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS selected_theme VARCHAR(20) DEFAULT 'default';
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS wheel_upgrades JSONB DEFAULT '{}';
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS daily_quest_bits INT DEFAULT 0;
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS last_daily_quest_reset TIMESTAMP DEFAULT now();
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS vip_tier INT DEFAULT 0;
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS vip_expire_at TIMESTAMP DEFAULT NULL;
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS friend_ids TEXT[] DEFAULT '{}'::TEXT[];

-- Clans Tabelle
CREATE TABLE IF NOT EXISTS clans (
  id VARCHAR(50) PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  name VARCHAR(50) NOT NULL,
  leader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_count INT DEFAULT 1,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Clan-Mitgliedschaft
CREATE TABLE IF NOT EXISTS clan_members (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clan_id VARCHAR(50) NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  joined_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (user_id, clan_id)
);

-- Leaderboards
CREATE TABLE IF NOT EXISTS leaderboards (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rank INT,
  score INT,
  coins_earned INT DEFAULT 0,
  period VARCHAR(20) DEFAULT 'global', -- 'global', 'weekly', 'seasonal'
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE (user_id, period)
);

-- Achievement-Tracking
CREATE TABLE IF NOT EXISTS achievement_log (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_id VARCHAR(50),
  unlocked_at TIMESTAMP DEFAULT now()
);

-- Seasonal Progress
CREATE TABLE IF NOT EXISTS seasonal_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  season_id VARCHAR(20),
  progress INT DEFAULT 0,
  rewards_claimed INT DEFAULT 0,
  PRIMARY KEY (user_id, season_id)
);

-- VIP-Logs
CREATE TABLE IF NOT EXISTS vip_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier INT,
  purchased_at TIMESTAMP DEFAULT now(),
  expire_at TIMESTAMP NOT NULL
);

-- Social: Freundschaften
CREATE TABLE IF NOT EXISTS friendships (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (user_id, friend_id),
  CHECK (user_id < friend_id)
);

-- Social: Geschenke
CREATE TABLE IF NOT EXISTS gifts (
  id SERIAL PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coins INT DEFAULT 0,
  spins INT DEFAULT 0,
  sent_at TIMESTAMP DEFAULT now(),
  claimed_at TIMESTAMP DEFAULT NULL
);

-- Indizes für Performance
CREATE INDEX IF NOT EXISTS idx_clans_leader ON clans(leader_id);
CREATE INDEX IF NOT EXISTS idx_clan_members_clan ON clan_members(clan_id);
CREATE INDEX IF NOT EXISTS idx_leaderboards_period ON leaderboards(period, rank);
CREATE INDEX IF NOT EXISTS idx_achievement_log_user ON achievement_log(user_id);
CREATE INDEX IF NOT EXISTS idx_seasonal_progress_season ON seasonal_progress(season_id);
CREATE INDEX IF NOT EXISTS idx_vip_logs_user ON vip_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_gifts_recipient ON gifts(recipient_id, claimed_at);
