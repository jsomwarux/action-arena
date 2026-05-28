export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type LeagueType = 'h2h' | 'cumulative';
export type LeagueVisibility = 'public' | 'private';
export type LeagueSport = 'nfl' | 'nba' | 'mlb';
export type LeagueStatus = 'drafting' | 'active' | 'playoffs' | 'complete';
export type BetType = 'straight' | 'parlay' | 'teaser';
export type BetMarket = 'moneyline' | 'spread' | 'over_under';
export type BetResult = 'pending' | 'win' | 'loss' | 'push';
export type LiveGameStatus = 'scheduled' | 'in_progress' | 'halftime' | 'final';
export type TeaserPoints = 6 | 6.5 | 7;
export type TeaserLegCount = 2 | 3 | 4;
export type AchievementKey =
  | 'hot_streak'
  | 'underdog_hunter'
  | 'perfect_week'
  | 'budget_master'
  | 'parlay_king'
  | 'teaser_genius';
export type NotificationType =
  | 'odds_available'
  | 'bet_reminders'
  | 'bet_results'
  | 'parlay_leg_updates'
  | 'parlay_hits'
  | 'matchup_results'
  | 'weekly_awards'
  | 'opponent_bets_locked';
export type NotificationStatus = 'pending' | 'sent' | 'skipped' | 'failed';
export type ChatMessageType = 'user' | 'system' | 'bet_share' | 'sticker';
export type ContentReportTargetType = 'chat_message' | 'league' | 'league_member' | 'user_profile';
export type ContentReportStatus = 'pending' | 'reviewed' | 'removed' | 'dismissed';
export type SeasonAwardKey =
  | 'season_mvp'
  | 'best_record'
  | 'parlay_king'
  | 'most_consistent'
  | 'biggest_single_bet';
export type CosmeticCategory =
  | 'team_logo'
  | 'trophy_skin'
  | 'lock_effect'
  | 'win_celebration'
  | 'chat_sticker_pack'
  | 'profile_frame';

export type UserRow = {
  arena_coins: number;
  avatar_url: string | null;
  created_at: string;
  display_name: string;
  email: string;
  id: string;
  is_premium: boolean;
  push_token: string | null;
};

export type UserInsert = {
  arena_coins?: number;
  avatar_url?: string | null;
  created_at?: string;
  display_name: string;
  email: string;
  id: string;
  is_premium?: boolean;
  push_token?: string | null;
};

export type UserUpdate = Partial<Omit<UserInsert, 'id'>> & {
  id?: string;
};

export type LeagueRow = {
  commissioner_id: string;
  created_at: string;
  current_week: number;
  description: string;
  id: string;
  invite_code: string;
  max_members: number;
  name: string;
  season_year: number;
  settings: Json | null;
  sport: LeagueSport;
  status: LeagueStatus;
  type: LeagueType;
  visibility: LeagueVisibility;
};

export type LeagueInsert = {
  commissioner_id: string;
  created_at?: string;
  current_week?: number;
  description?: string;
  id?: string;
  invite_code: string;
  max_members?: number;
  name: string;
  season_year: number;
  settings?: Json | null;
  sport?: LeagueSport;
  status?: LeagueStatus;
  type: LeagueType;
  visibility: LeagueVisibility;
};

export type LeagueUpdate = Partial<LeagueInsert>;

export type LeagueMemberRow = {
  id: string;
  joined_at: string;
  league_id: string;
  team_name: string;
  user_id: string;
};

export type LeagueMemberInsert = {
  id?: string;
  joined_at?: string;
  league_id: string;
  team_name: string;
  user_id: string;
};

export type LeagueMemberUpdate = Partial<LeagueMemberInsert>;

export type WeeklyMatchupRow = {
  away_profit: number | null;
  away_user_id: string | null;
  home_profit: number | null;
  home_user_id: string;
  id: string;
  is_championship: boolean;
  is_playoff: boolean;
  league_id: string;
  week_number: number;
  winner_id: string | null;
};

export type WeeklyMatchupInsert = {
  away_profit?: number | null;
  away_user_id?: string | null;
  home_profit?: number | null;
  home_user_id: string;
  id?: string;
  is_championship?: boolean;
  is_playoff?: boolean;
  league_id: string;
  week_number: number;
  winner_id?: string | null;
};

export type WeeklyMatchupUpdate = Partial<WeeklyMatchupInsert>;

export type BetRow = {
  amount: number;
  bet_type: BetType;
  created_at: string;
  id: string;
  is_lock: boolean;
  league_id: string;
  odds: number;
  potential_payout: number;
  profit: number | null;
  result: BetResult;
  teaser_points: TeaserPoints | null;
  user_id: string;
  week_number: number;
};

export type BetInsert = {
  amount: number;
  bet_type: BetType;
  created_at?: string;
  id?: string;
  is_lock?: boolean;
  league_id: string;
  odds: number;
  potential_payout: number;
  profit?: number | null;
  result?: BetResult;
  teaser_points?: TeaserPoints | null;
  user_id: string;
  week_number: number;
};

export type BetUpdate = Partial<BetInsert>;

export type BetLegRow = {
  adjusted_line: number | null;
  bet_id: string;
  game_id: string;
  game_start_time: string;
  id: string;
  leg_odds: number;
  locked: boolean;
  market: BetMarket;
  original_line: number | null;
  result: BetResult;
  selection: string;
};

export type BetLegInsert = {
  adjusted_line?: number | null;
  bet_id: string;
  game_id: string;
  game_start_time: string;
  id?: string;
  leg_odds: number;
  locked?: boolean;
  market: BetMarket;
  original_line?: number | null;
  result?: BetResult;
  selection: string;
};

export type BetLegUpdate = Partial<BetLegInsert>;

export type StandingRow = {
  id: string;
  league_id: string;
  losses: number;
  rank: number;
  ties: number;
  total_profit: number;
  user_id: string;
  week_number: number;
  weekly_profit: number;
  wins: number;
};

export type StandingInsert = {
  id?: string;
  league_id: string;
  losses?: number;
  rank: number;
  ties?: number;
  total_profit?: number;
  user_id: string;
  week_number: number;
  weekly_profit?: number;
  wins?: number;
};

export type StandingUpdate = Partial<StandingInsert>;

export type UserAchievementRow = {
  achievement_key: AchievementKey;
  earned_at: string;
  id: string;
  league_id: string;
  metadata: Json;
  user_id: string;
};

export type UserAchievementInsert = {
  achievement_key: AchievementKey;
  earned_at?: string;
  id?: string;
  league_id: string;
  metadata?: Json;
  user_id: string;
};

export type UserAchievementUpdate = Partial<UserAchievementInsert>;

export type NotificationPreferencesRow = {
  bet_reminders: boolean;
  bet_results: boolean;
  created_at: string;
  matchup_results: boolean;
  odds_available: boolean;
  opponent_bets_locked: boolean;
  parlay_hits: boolean;
  parlay_leg_updates: boolean;
  updated_at: string;
  user_id: string;
  weekly_awards: boolean;
};

export type NotificationPreferencesInsert = {
  bet_reminders?: boolean;
  bet_results?: boolean;
  created_at?: string;
  matchup_results?: boolean;
  odds_available?: boolean;
  opponent_bets_locked?: boolean;
  parlay_hits?: boolean;
  parlay_leg_updates?: boolean;
  updated_at?: string;
  user_id: string;
  weekly_awards?: boolean;
};

export type NotificationPreferencesUpdate = Partial<NotificationPreferencesInsert>;

export type NotificationEventRow = {
  bet_id: string | null;
  body: string;
  created_at: string;
  data: Json;
  error: string | null;
  id: string;
  idempotency_key: string | null;
  league_id: string | null;
  matchup_id: string | null;
  notification_type: NotificationType;
  recipient_user_id: string;
  sent_at: string | null;
  status: NotificationStatus;
  title: string;
};

export type NotificationEventInsert = {
  bet_id?: string | null;
  body: string;
  created_at?: string;
  data?: Json;
  error?: string | null;
  id?: string;
  idempotency_key?: string | null;
  league_id?: string | null;
  matchup_id?: string | null;
  notification_type: NotificationType;
  recipient_user_id: string;
  sent_at?: string | null;
  status?: NotificationStatus;
  title: string;
};

export type NotificationEventUpdate = Partial<NotificationEventInsert>;

export type LeagueChatMessageRow = {
  bet_id: string | null;
  body: string;
  created_at: string;
  id: string;
  league_id: string;
  message_type: ChatMessageType;
  metadata: Json;
  moderation_status: 'active' | 'removed';
  removal_reason: string | null;
  removed_at: string | null;
  removed_by: string | null;
  user_id: string | null;
};

export type LeagueChatMessageInsert = {
  bet_id?: string | null;
  body?: string;
  created_at?: string;
  id?: string;
  league_id: string;
  message_type?: ChatMessageType;
  metadata?: Json;
  moderation_status?: 'active' | 'removed';
  removal_reason?: string | null;
  removed_at?: string | null;
  removed_by?: string | null;
  user_id?: string | null;
};

export type LeagueChatMessageUpdate = Partial<LeagueChatMessageInsert>;

export type UserBlockRow = {
  blocked_user_id: string;
  blocker_user_id: string;
  created_at: string;
};

export type UserBlockInsert = {
  blocked_user_id: string;
  blocker_user_id: string;
  created_at?: string;
};

export type UserBlockUpdate = Partial<UserBlockInsert>;

export type ContentReportRow = {
  action_taken: string | null;
  content_snapshot: Json;
  created_at: string;
  details: string | null;
  id: string;
  league_id: string | null;
  reason: string;
  reported_user_id: string | null;
  reporter_user_id: string;
  review_note: string | null;
  reviewed_at: string | null;
  reviewer_user_id: string | null;
  status: ContentReportStatus;
  target_id: string;
  target_type: ContentReportTargetType;
  updated_at: string;
};

export type ContentReportInsert = {
  action_taken?: string | null;
  content_snapshot?: Json;
  created_at?: string;
  details?: string | null;
  id?: string;
  league_id?: string | null;
  reason?: string;
  reported_user_id?: string | null;
  reporter_user_id: string;
  review_note?: string | null;
  reviewed_at?: string | null;
  reviewer_user_id?: string | null;
  status?: ContentReportStatus;
  target_id: string;
  target_type: ContentReportTargetType;
  updated_at?: string;
};

export type ContentReportUpdate = Partial<ContentReportInsert>;

export type CosmeticCatalogRow = {
  category: CosmeticCategory;
  coin_cost: number;
  created_at: string;
  is_season_pass_exclusive: boolean;
  item_id: string;
  name: string;
  season_label: string | null;
};

export type CosmeticCatalogInsert = {
  category: CosmeticCategory;
  coin_cost?: number;
  created_at?: string;
  is_season_pass_exclusive?: boolean;
  item_id: string;
  name: string;
  season_label?: string | null;
};

export type CosmeticCatalogUpdate = Partial<CosmeticCatalogInsert>;

export type UserCosmeticRow = {
  category: CosmeticCategory;
  equipped_at: string | null;
  id: string;
  is_equipped: boolean;
  item_id: string;
  metadata: Json;
  purchased_at: string;
  user_id: string;
};

export type UserCosmeticInsert = {
  category: CosmeticCategory;
  equipped_at?: string | null;
  id?: string;
  is_equipped?: boolean;
  item_id: string;
  metadata?: Json;
  purchased_at?: string;
  user_id: string;
};

export type UserCosmeticUpdate = Partial<UserCosmeticInsert>;

export type EquippedCosmeticsByCategory = Partial<Record<CosmeticCategory, UserCosmeticRow>>;

export type SeasonPassRow = {
  created_at: string;
  id: string;
  redeemed_code: string | null;
  season_year: number;
  source: string;
  user_id: string;
};

export type SeasonPassInsert = {
  created_at?: string;
  id?: string;
  redeemed_code?: string | null;
  season_year: number;
  source?: string;
  user_id: string;
};

export type SeasonPassUpdate = Partial<SeasonPassInsert>;

export type SeasonPassRedeemCodeRow = {
  active: boolean;
  code: string;
  created_at: string;
  expires_at: string | null;
  max_redemptions: number | null;
  redeemed_count: number;
  season_year: number;
};

export type OddsReleaseWindowRow = {
  created_at: string;
  id: string;
  odds_available_at: string;
  season_year: number;
  sport: LeagueSport;
  week_number: number;
};

export type LeagueWeekSlateGameRow = {
  away_team: string | null;
  commence_time: string;
  created_at: string;
  game_id: string;
  home_team: string | null;
  id: string;
  league_id: string;
  updated_at: string;
  week_number: number;
};

export type LeagueWeekSlateGameInsert = {
  away_team?: string | null;
  commence_time: string;
  created_at?: string;
  game_id: string;
  home_team?: string | null;
  id?: string;
  league_id: string;
  updated_at?: string;
  week_number: number;
};

export type LeagueWeekSlateGameUpdate = Partial<LeagueWeekSlateGameInsert>;

export type GameRow = {
  away_team: string | null;
  commence_time: string;
  created_at: string;
  game_id: string;
  home_team: string | null;
  season_year: number | null;
  sport: LeagueSport;
  updated_at: string;
  week_number: number | null;
};

export type GameInsert = {
  away_team?: string | null;
  commence_time: string;
  created_at?: string;
  game_id: string;
  home_team?: string | null;
  season_year?: number | null;
  sport?: LeagueSport;
  updated_at?: string;
  week_number?: number | null;
};

export type GameUpdate = Partial<GameInsert>;

export type GlobalSportWeekRow = {
  current_week: number;
  season_year: number;
  sport: LeagueSport;
  updated_at: string;
  updated_by: string | null;
};

export type GlobalSportWeekInsert = {
  current_week: number;
  season_year: number;
  sport: LeagueSport;
  updated_at?: string;
  updated_by?: string | null;
};

export type GlobalSportWeekUpdate = Partial<GlobalSportWeekInsert>;

export type LiveGameStateRow = {
  away_score: number;
  away_team: string;
  created_at: string;
  current_period: string | null;
  game_id: string;
  home_score: number;
  home_team: string;
  last_updated: string;
  sport_key: string;
  status: LiveGameStatus;
  time_remaining: string | null;
  updated_at: string;
};

export type LiveGameStateInsert = {
  away_score?: number;
  away_team: string;
  created_at?: string;
  current_period?: string | null;
  game_id: string;
  home_score?: number;
  home_team: string;
  last_updated?: string;
  sport_key?: string;
  status?: LiveGameStatus;
  time_remaining?: string | null;
  updated_at?: string;
};

export type LiveGameStateUpdate = Partial<LiveGameStateInsert>;

export type SeasonAwardBetLegSnapshot = {
  adjusted_line: number | null;
  game_id: string;
  leg_odds: number;
  market: BetMarket;
  original_line: number | null;
  selection: string;
};

export type SeasonAwardBetSnapshot = {
  amount: number;
  bet_type: BetType;
  id: string;
  is_lock: boolean;
  legs: SeasonAwardBetLegSnapshot[];
  odds: number;
  potential_payout: number;
  profit: number | null;
  week_number: number;
};

export type SeasonAward = {
  award_key: SeasonAwardKey;
  award_label: string;
  bet?: SeasonAwardBetSnapshot | null;
  bet_id?: string;
  is_lock?: boolean;
  metric: number | null;
  user_id: string | null;
  value_label: string | null;
};

export type SeasonStandingSnapshot = {
  losses: number;
  rank: number;
  ties: number;
  total_profit: number;
  user_id: string;
  weekly_profit: number;
  wins: number;
};

export type ChampionshipSummary = {
  champion_profit: number | null;
  champion_user_id: string;
  opponent_profit: number | null;
  opponent_user_id: string | null;
  week_number: number;
};

export type SeasonRow = {
  awards: Json;
  champion_user_id: string | null;
  championship_summary: Json | null;
  completed_at: string;
  final_standings: Json;
  id: string;
  league_id: string;
  season_year: number;
};

export type SeasonInsert = {
  awards?: Json;
  champion_user_id?: string | null;
  championship_summary?: Json | null;
  completed_at?: string;
  final_standings?: Json;
  id?: string;
  league_id: string;
  season_year: number;
};

export type SeasonUpdate = Partial<SeasonInsert>;

export type StraightBet = BetRow & {
  bet_type: 'straight';
  teaser_points: null;
};

export type ParlayBet = BetRow & {
  bet_type: 'parlay';
  teaser_points: null;
};

export type TeaserBet = BetRow & {
  bet_type: 'teaser';
  teaser_points: TeaserPoints;
};

export type BetWithLegs = (StraightBet | ParlayBet | TeaserBet) & {
  bet_legs: BetLegRow[];
};

export type LeagueWithMembers = LeagueRow & {
  league_members: LeagueMemberRow[];
};

export type Database = {
  public: {
    CompositeTypes: Record<never, never>;
    Enums: {
      bet_market: BetMarket;
      bet_result: BetResult;
      bet_type: BetType;
      chat_message_type: ChatMessageType;
      content_report_status: ContentReportStatus;
      content_report_target_type: ContentReportTargetType;
      league_sport: LeagueSport;
      league_status: LeagueStatus;
      league_type: LeagueType;
      league_visibility: LeagueVisibility;
      notification_type: NotificationType;
    };
    Functions: {
      activate_league_and_generate_schedule: {
        Args: {
          p_league_id: string;
        };
        Returns: number;
      };
      align_active_nfl_leagues_to_week: {
        Args: {
          p_dry_run?: boolean;
          p_excluded_league_names?: string[];
          p_prune_future_artifacts?: boolean;
          p_season_year?: number | null;
          p_target_week: number;
        };
        Returns: Json;
      };
      align_nfl_leagues_to_week: {
        Args: {
          p_dry_run?: boolean;
          p_prune_future_artifacts?: boolean;
          p_season_year?: number | null;
          p_target_week: number;
        };
        Returns: Json;
      };
      advance_global_nfl_week_if_ready: {
        Args: {
          p_completed_week: number;
          p_season_year: number;
        };
        Returns: boolean;
      };
      create_league: {
        Args: {
          p_description?: string;
          p_max_members: number;
          p_name: string;
          p_season_year?: number;
          p_sport?: LeagueSport;
          p_type: LeagueType;
          p_visibility: LeagueVisibility;
        };
        Returns: string;
      };
      is_league_commissioner: {
        Args: {
          target_league_id: string;
          target_user_id?: string;
        };
        Returns: boolean;
      };
      is_league_member: {
        Args: {
          target_league_id: string;
          target_user_id?: string;
        };
        Returns: boolean;
      };
      can_access_bet_board: {
        Args: {
          p_league_id: string;
          p_user_id?: string;
          p_week_number: number;
        };
        Returns: boolean;
      };
      can_view_bet_details: {
        Args: {
          p_bet_user_id: string;
          p_league_id: string;
          p_week_number: number;
        };
        Returns: boolean;
      };
      get_my_arena_coin_balance: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      moderate_content_report: {
        Args: {
          p_report_id: string;
          p_review_note?: string | null;
          p_status: ContentReportStatus;
        };
        Returns: string;
      };
      remove_league_chat_message: {
        Args: {
          p_message_id: string;
          p_reason?: string | null;
        };
        Returns: string;
      };
      equip_cosmetic: {
        Args: {
          p_item_id: string;
        };
        Returns: string;
      };
      get_matchup_detail: {
        Args: {
          p_matchup_id: string;
        };
        Returns: Json;
      };
      has_season_pass: {
        Args: {
          target_season_year?: number;
          target_user_id?: string;
        };
        Returns: boolean;
      };
      join_league: {
        Args: {
          p_league_id: string;
        };
        Returns: string;
      };
      join_league_by_invite_code: {
        Args: {
          p_invite_code: string;
        };
        Returns: string;
      };
      league_week_picks_revealed: {
        Args: {
          p_league_id: string;
          p_week_number: number;
        };
        Returns: boolean;
      };
      league_week_reveal_time: {
        Args: {
          p_league_id: string;
          p_week_number: number;
        };
        Returns: string | null;
      };
      live_score_polling_candidates: {
        Args: Record<PropertyKey, never>;
        Returns: Array<{
          away_team: string;
          commence_time: string;
          game_id: string;
          home_team: string;
          status: LiveGameStatus;
        }>;
      };
      enqueue_weekly_award_notification: {
        Args: {
          p_award_label: string;
          p_league_id: string;
          p_user_id: string;
          p_week_number: number;
        };
        Returns: string | null;
      };
      make_invite_code: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      purchase_cosmetic: {
        Args: {
          p_item_id: string;
        };
        Returns: string;
      };
      public_league_member_counts: {
        Args: {
          p_league_ids: string[];
        };
        Returns: Array<{
          league_id: string;
          member_count: number;
        }>;
      };
      redeem_season_pass: {
        Args: {
          p_code: string;
          p_season_year?: number;
        };
        Returns: string;
      };
      set_global_sport_week: {
        Args: {
          p_season_year: number;
          p_sport: LeagueSport;
          p_target_week: number;
          p_updated_by?: string | null;
        };
        Returns: Json;
      };
      set_pick_of_week: {
        Args: {
          p_bet_id: string;
        };
        Returns: string;
      };
      resolve_ready_weekly_standings: {
        Args: {
          p_league_id?: string | null;
          p_week_number?: number | null;
        };
        Returns: number;
      };
      settle_completed_scores: {
        Args: {
          p_scores: Json;
        };
        Returns: Json;
      };
      simulate_global_week_completion: {
        Args: {
          p_scores: Json;
          p_season_year?: number | null;
          p_week_number: number;
        };
        Returns: Json;
      };
      simulate_global_week_kickoff: {
        Args: {
          p_season_year?: number | null;
          p_week_number: number;
        };
        Returns: Json;
      };
      upsert_live_game_states: {
        Args: {
          p_scores: Json;
        };
        Returns: number;
      };
      submit_straight_bets: {
        Args: {
          p_bets: Json;
          p_league_id: string;
          p_week_number: number;
        };
        Returns: string[];
      };
      submit_bets: {
        Args: {
          p_bets: Json;
          p_league_id: string;
          p_week_number: number;
        };
        Returns: string[];
      };
      sync_league_week_slate: {
        Args: {
          p_games: Json;
          p_league_id: string;
          p_week_number: number;
        };
        Returns: string | null;
      };
      update_submitted_bet: {
        Args: {
          p_bet_id: string;
          p_legs: Json;
          p_odds: number;
          p_potential_payout: number;
          p_teaser_points: number | null;
        };
        Returns: string;
      };
    };
    Tables: {
      cosmetic_catalog: {
        Insert: CosmeticCatalogInsert;
        Relationships: [];
        Row: CosmeticCatalogRow;
        Update: CosmeticCatalogUpdate;
      };
      bet_legs: {
        Insert: BetLegInsert;
        Relationships: [
          {
            columns: ['bet_id'];
            foreignKeyName: 'bet_legs_bet_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'bets';
          },
        ];
        Row: BetLegRow;
        Update: BetLegUpdate;
      };
      bets: {
        Insert: BetInsert;
        Relationships: [
          {
            columns: ['league_id'];
            foreignKeyName: 'bets_league_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'leagues';
          },
          {
            columns: ['user_id'];
            foreignKeyName: 'bets_user_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'users';
          },
        ];
        Row: BetRow;
        Update: BetUpdate;
      };
      content_reports: {
        Insert: ContentReportInsert;
        Relationships: [
          {
            columns: ['league_id'];
            foreignKeyName: 'content_reports_league_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'leagues';
          },
          {
            columns: ['reported_user_id'];
            foreignKeyName: 'content_reports_reported_user_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'users';
          },
          {
            columns: ['reporter_user_id'];
            foreignKeyName: 'content_reports_reporter_user_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'users';
          },
          {
            columns: ['reviewer_user_id'];
            foreignKeyName: 'content_reports_reviewer_user_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'users';
          },
        ];
        Row: ContentReportRow;
        Update: ContentReportUpdate;
      };
      games: {
        Insert: GameInsert;
        Relationships: [];
        Row: GameRow;
        Update: GameUpdate;
      };
      global_sport_weeks: {
        Insert: GlobalSportWeekInsert;
        Relationships: [];
        Row: GlobalSportWeekRow;
        Update: GlobalSportWeekUpdate;
      };
      league_members: {
        Insert: LeagueMemberInsert;
        Relationships: [
          {
            columns: ['league_id'];
            foreignKeyName: 'league_members_league_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'leagues';
          },
          {
            columns: ['user_id'];
            foreignKeyName: 'league_members_user_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'users';
          },
        ];
        Row: LeagueMemberRow;
        Update: LeagueMemberUpdate;
      };
      league_chat_messages: {
        Insert: LeagueChatMessageInsert;
        Relationships: [
          {
            columns: ['bet_id'];
            foreignKeyName: 'league_chat_messages_bet_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'bets';
          },
          {
            columns: ['league_id'];
            foreignKeyName: 'league_chat_messages_league_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'leagues';
          },
          {
            columns: ['user_id'];
            foreignKeyName: 'league_chat_messages_user_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'users';
          },
        ];
        Row: LeagueChatMessageRow;
        Update: LeagueChatMessageUpdate;
      };
      league_week_slate_games: {
        Insert: LeagueWeekSlateGameInsert;
        Relationships: [
          {
            columns: ['league_id'];
            foreignKeyName: 'league_week_slate_games_league_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'leagues';
          },
        ];
        Row: LeagueWeekSlateGameRow;
        Update: LeagueWeekSlateGameUpdate;
      };
      live_game_states: {
        Insert: LiveGameStateInsert;
        Relationships: [];
        Row: LiveGameStateRow;
        Update: LiveGameStateUpdate;
      };
      seasons: {
        Insert: SeasonInsert;
        Relationships: [
          {
            columns: ['league_id'];
            foreignKeyName: 'seasons_league_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'leagues';
          },
          {
            columns: ['champion_user_id'];
            foreignKeyName: 'seasons_champion_user_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'users';
          },
        ];
        Row: SeasonRow;
        Update: SeasonUpdate;
      };
      leagues: {
        Insert: LeagueInsert;
        Relationships: [
          {
            columns: ['commissioner_id'];
            foreignKeyName: 'leagues_commissioner_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'users';
          },
        ];
        Row: LeagueRow;
        Update: LeagueUpdate;
      };
      notification_events: {
        Insert: NotificationEventInsert;
        Relationships: [
          {
            columns: ['bet_id'];
            foreignKeyName: 'notification_events_bet_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'bets';
          },
          {
            columns: ['league_id'];
            foreignKeyName: 'notification_events_league_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'leagues';
          },
          {
            columns: ['matchup_id'];
            foreignKeyName: 'notification_events_matchup_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'weekly_matchups';
          },
          {
            columns: ['recipient_user_id'];
            foreignKeyName: 'notification_events_recipient_user_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'users';
          },
        ];
        Row: NotificationEventRow;
        Update: NotificationEventUpdate;
      };
      notification_preferences: {
        Insert: NotificationPreferencesInsert;
        Relationships: [
          {
            columns: ['user_id'];
            foreignKeyName: 'notification_preferences_user_id_fkey';
            isOneToOne: true;
            referencedColumns: ['id'];
            referencedRelation: 'users';
          },
        ];
        Row: NotificationPreferencesRow;
        Update: NotificationPreferencesUpdate;
      };
      odds_release_windows: {
        Insert: {
          created_at?: string;
          id?: string;
          odds_available_at: string;
          season_year: number;
          sport?: LeagueSport;
          week_number: number;
        };
        Relationships: [];
        Row: OddsReleaseWindowRow;
        Update: Partial<{
          created_at: string;
          id: string;
          odds_available_at: string;
          season_year: number;
          sport: LeagueSport;
          week_number: number;
        }>;
      };
      season_passes: {
        Insert: SeasonPassInsert;
        Relationships: [
          {
            columns: ['user_id'];
            foreignKeyName: 'season_passes_user_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'users';
          },
        ];
        Row: SeasonPassRow;
        Update: SeasonPassUpdate;
      };
      season_pass_redeem_codes: {
        Insert: {
          active?: boolean;
          code: string;
          created_at?: string;
          expires_at?: string | null;
          max_redemptions?: number | null;
          redeemed_count?: number;
          season_year: number;
        };
        Relationships: [];
        Row: SeasonPassRedeemCodeRow;
        Update: Partial<{
          active: boolean;
          code: string;
          created_at: string;
          expires_at: string | null;
          max_redemptions: number | null;
          redeemed_count: number;
          season_year: number;
        }>;
      };
      standings: {
        Insert: StandingInsert;
        Relationships: [
          {
            columns: ['league_id'];
            foreignKeyName: 'standings_league_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'leagues';
          },
          {
            columns: ['user_id'];
            foreignKeyName: 'standings_user_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'users';
          },
        ];
        Row: StandingRow;
        Update: StandingUpdate;
      };
      user_achievements: {
        Insert: UserAchievementInsert;
        Relationships: [
          {
            columns: ['league_id'];
            foreignKeyName: 'user_achievements_league_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'leagues';
          },
          {
            columns: ['user_id'];
            foreignKeyName: 'user_achievements_user_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'users';
          },
        ];
        Row: UserAchievementRow;
        Update: UserAchievementUpdate;
      };
      user_cosmetics: {
        Insert: UserCosmeticInsert;
        Relationships: [
          {
            columns: ['item_id'];
            foreignKeyName: 'user_cosmetics_item_id_fkey';
            isOneToOne: false;
            referencedColumns: ['item_id'];
            referencedRelation: 'cosmetic_catalog';
          },
          {
            columns: ['user_id'];
            foreignKeyName: 'user_cosmetics_user_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'users';
          },
        ];
        Row: UserCosmeticRow;
        Update: UserCosmeticUpdate;
      };
      user_blocks: {
        Insert: UserBlockInsert;
        Relationships: [
          {
            columns: ['blocked_user_id'];
            foreignKeyName: 'user_blocks_blocked_user_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'users';
          },
          {
            columns: ['blocker_user_id'];
            foreignKeyName: 'user_blocks_blocker_user_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'users';
          },
        ];
        Row: UserBlockRow;
        Update: UserBlockUpdate;
      };
      users: {
        Insert: UserInsert;
        Relationships: [];
        Row: UserRow;
        Update: UserUpdate;
      };
      weekly_matchups: {
        Insert: WeeklyMatchupInsert;
        Relationships: [
          {
            columns: ['away_user_id'];
            foreignKeyName: 'weekly_matchups_away_user_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'users';
          },
          {
            columns: ['home_user_id'];
            foreignKeyName: 'weekly_matchups_home_user_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'users';
          },
          {
            columns: ['league_id'];
            foreignKeyName: 'weekly_matchups_league_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'leagues';
          },
          {
            columns: ['winner_id'];
            foreignKeyName: 'weekly_matchups_winner_id_fkey';
            isOneToOne: false;
            referencedColumns: ['id'];
            referencedRelation: 'users';
          },
        ];
        Row: WeeklyMatchupRow;
        Update: WeeklyMatchupUpdate;
      };
    };
    Views: Record<never, never>;
  };
};
