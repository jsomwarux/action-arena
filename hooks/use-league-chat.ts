import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { logAnalyticsEvent } from '@/lib/analytics';
import { formatPickTitle } from '@/lib/pick-labels';
import { supabase } from '@/lib/supabase';
import type {
  BetWithLegs,
  BetLegRow,
  BetRow,
  Json,
  LeagueChatMessageInsert,
  LeagueChatMessageRow,
  UserRow,
} from '@/types/database';

export type LeagueChatMessage = LeagueChatMessageRow & {
  user: UserRow | null;
};

export type ShareableBet = BetRow & {
  bet_legs: BetLegRow[];
};

export type SharedBetMetadata = {
  amount: number;
  betType: BetWithLegs['bet_type'];
  isLock?: boolean;
  legs: {
    adjustedLine: number | null;
    market: BetLegRow['market'];
    odds: number;
    originalLine: number | null;
    result: BetLegRow['result'];
    selection: string;
  }[];
  odds: number;
  potentialReward: number;
  result: BetWithLegs['result'];
  weekNumber: number;
};

export type StickerMessageMetadata = {
  stickerId: string;
  stickerName: string;
};

const chatKeys = {
  messages: (leagueId: string | undefined, limit: number) =>
    ['league-chat', leagueId, limit] as const,
};

function assertSupabaseResult<T>(data: T | null, error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }

  if (data === null) {
    throw new Error('No data returned from Supabase.');
  }

  return data;
}

function messageBodyForBet(bet: ShareableBet) {
  const lockPrefix = bet.is_lock ? 'Shared a Pick of the Week: ' : 'Shared a pick: ';

  if (bet.bet_type === 'straight') {
    return `${lockPrefix}${formatPickTitle(bet)}`;
  }

  return bet.is_lock
    ? `Shared a Pick of the Week: ${bet.bet_legs.length}-leg ${bet.bet_type}`
    : `Shared a ${bet.bet_legs.length}-leg ${bet.bet_type}`;
}

function metadataForBet(bet: ShareableBet): SharedBetMetadata {
  return {
    amount: bet.amount,
    betType: bet.bet_type,
    isLock: bet.is_lock,
    legs: bet.bet_legs.map((leg) => ({
      adjustedLine: leg.adjusted_line,
      market: leg.market,
      odds: leg.leg_odds,
      originalLine: leg.original_line,
      result: leg.result,
      selection: leg.selection,
    })),
    odds: bet.odds,
    potentialReward: bet.potential_payout,
    result: bet.result,
    weekNumber: bet.week_number,
  };
}

export function useLeagueChat(leagueId: string | undefined, limit: number) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!leagueId) {
      return;
    }

    const channel = supabase
      .channel(`league-chat:${leagueId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          filter: `league_id=eq.${leagueId}`,
          schema: 'public',
          table: 'league_chat_messages',
        },
        () => {
          void queryClient.invalidateQueries({ queryKey: chatKeys.messages(leagueId, limit) });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [leagueId, limit, queryClient]);

  return useQuery({
    enabled: Boolean(leagueId),
    queryFn: async (): Promise<LeagueChatMessage[]> => {
      if (!leagueId) {
        return [];
      }

      const { data, error } = await supabase
        .from('league_chat_messages')
        .select('*, users(*)')
        .eq('league_id', leagueId)
        .order('created_at', { ascending: false })
        .limit(limit);

      const rows = assertSupabaseResult(
        data as (LeagueChatMessageRow & { users: UserRow | null })[] | null,
        error,
      );

      return rows
        .map((message) => {
          const { users, ...row } = message;
          return { ...row, user: users };
        })
        .reverse();
    },
    queryKey: chatKeys.messages(leagueId, limit),
  });
}

export function useSendLeagueChatMessage(leagueId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (body: string) => {
      if (!leagueId || !userId) {
        throw new Error('League and user are required.');
      }

      const payload: LeagueChatMessageInsert = {
        body: body.trim(),
        league_id: leagueId,
        message_type: 'user',
        user_id: userId,
      };

      const { data, error } = await supabase
        .from('league_chat_messages')
        .insert(payload)
        .select('*')
        .single();

      return assertSupabaseResult(data, error);
    },
    onSuccess: async () => {
      logAnalyticsEvent('chat_message_sent', {
        league_id: leagueId,
        user_id: userId,
      });
      await queryClient.invalidateQueries({ queryKey: ['league-chat', leagueId] });
    },
  });
}

export function useSendLeagueChatSticker(leagueId: string | undefined, userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sticker: StickerMessageMetadata) => {
      if (!leagueId || !userId) {
        throw new Error('League and user are required.');
      }

      const payload: LeagueChatMessageInsert = {
        body: sticker.stickerName,
        league_id: leagueId,
        message_type: 'sticker',
        metadata: sticker as unknown as Json,
        user_id: userId,
      };

      const { data, error } = await supabase
        .from('league_chat_messages')
        .insert(payload)
        .select('*')
        .single();

      return assertSupabaseResult(data, error);
    },
    onSuccess: async (_data, sticker) => {
      logAnalyticsEvent('chat_message_sent', {
        league_id: leagueId,
        message_type: 'sticker',
        sticker_id: sticker.stickerId,
        user_id: userId,
      });
      await queryClient.invalidateQueries({ queryKey: ['league-chat', leagueId] });
    },
  });
}

export function useShareBetToChat(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bet: ShareableBet) => {
      if (!userId) {
        throw new Error('User is required.');
      }

      const payload: LeagueChatMessageInsert = {
        bet_id: bet.id,
        body: messageBodyForBet(bet),
        league_id: bet.league_id,
        message_type: 'bet_share',
        metadata: metadataForBet(bet) as unknown as Json,
        user_id: userId,
      };

      const { data, error } = await supabase
        .from('league_chat_messages')
        .insert(payload)
        .select('*')
        .single();

      return assertSupabaseResult(data, error);
    },
    onSuccess: async (_data, bet) => {
      logAnalyticsEvent('pick_shared_to_chat', {
        pick_id: bet.id,
        pick_type: bet.bet_type,
        is_lock: bet.is_lock,
        league_id: bet.league_id,
        user_id: userId,
      });
      await queryClient.invalidateQueries({ queryKey: ['league-chat', bet.league_id] });
    },
  });
}
