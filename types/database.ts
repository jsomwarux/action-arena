export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type LeagueType = 'h2h' | 'cumulative';
export type LeagueVisibility = 'public' | 'private';
export type LeagueSport = 'nfl' | 'nba' | 'mlb';
export type LeagueStatus = 'drafting' | 'active' | 'playoffs' | 'complete';
export type BetType = 'straight' | 'parlay' | 'teaser';
export type BetMarket = 'moneyline' | 'spread' | 'over_under';
export type BetResult = 'pending' | 'win' | 'loss' | 'push';
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
export type ChatMessageType = 'user' | 'system' | 'bet_share';

export type UserRow = {
  avatar_url: string | null;
  created_at: string;
  display_name: string;
  email: string;
  id: string;
  is_premium: boolean;
  push_token: string | null;
};

export type UserInsert = {
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
  user_id?: string | null;
};

export type LeagueChatMessageUpdate = Partial<LeagueChatMessageInsert>;

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
    };
    Tables: {
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
