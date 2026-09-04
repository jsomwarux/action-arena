import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { logAnalyticsEvent } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import type {
  ContentReportInsert,
  ContentReportTargetType,
  Json,
  MessageReportInsert,
  MessageReportRow,
  UserBlockInsert,
  UserBlockRow,
  UserRow,
} from '@/types/database';

export const MESSAGE_REPORT_REASONS = [
  'Spam',
  'Harassment',
  'Hate speech',
  'Sexual content',
  'Violence',
  'Other',
] as const;

export type MessageReportReason = (typeof MESSAGE_REPORT_REASONS)[number];

export type ReportContentInput = {
  contentSnapshot: Json;
  details?: string;
  leagueId?: string;
  reason?: string;
  reportedUserId?: string;
  targetId: string;
  targetType: ContentReportTargetType;
};

export type ReportMessageInput = {
  details?: string;
  leagueId: string;
  reason: MessageReportReason;
  reportedMessageId: string;
  reportedUserId: string;
};

export type BlockUserInput = {
  blockedUserId: string;
  leagueId?: string | null;
};

export type PublicBlockedUser = Pick<
  UserRow,
  'avatar_url' | 'created_at' | 'display_name' | 'id' | 'is_premium'
>;

export type BlockedUser = UserBlockRow & {
  blockedUser: PublicBlockedUser | null;
};

export type ChatModerationStatus = {
  chat_banned: boolean;
  chat_terms_accepted_at: string | null;
};

const moderationKeys = {
  blockedUsers: (userId: string | undefined) => ['blocked-users', userId] as const,
  chatStatus: (userId: string | undefined) => ['chat-moderation-status', userId] as const,
  messageReports: (leagueId: string | undefined) => ['message-reports', leagueId] as const,
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

export function useReportContentMutation(reporterUserId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ReportContentInput) => {
      if (!reporterUserId) {
        throw new Error('You must be signed in to report content.');
      }

      const payload: ContentReportInsert = {
        content_snapshot: input.contentSnapshot,
        details: input.details?.trim() || null,
        league_id: input.leagueId ?? null,
        reason: input.reason ?? 'objectionable_content',
        reported_user_id: input.reportedUserId ?? null,
        reporter_user_id: reporterUserId,
        target_id: input.targetId,
        target_type: input.targetType,
      };

      const { data, error } = await supabase
        .from('content_reports')
        .upsert(payload, {
          onConflict: 'reporter_user_id,target_type,target_id',
        })
        .select('*')
        .single();

      return assertSupabaseResult(data, error);
    },
    onSuccess: async (report, input) => {
      logAnalyticsEvent('content_report_created', {
        league_id: input.leagueId,
        reported_user_id: input.reportedUserId,
        reporter_user_id: reporterUserId,
        target_type: input.targetType,
      });
      await queryClient.invalidateQueries({ queryKey: ['content-reports', report.league_id] });
    },
  });
}

export function useReportMessageMutation(reporterUserId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ReportMessageInput): Promise<MessageReportRow> => {
      if (!reporterUserId) {
        throw new Error('You must be signed in to report a message.');
      }

      const payload: MessageReportInsert = {
        details: input.details?.trim() || null,
        league_id: input.leagueId,
        reason: input.reason,
        reported_message_id: input.reportedMessageId,
        reported_user_id: input.reportedUserId,
        reporter_id: reporterUserId,
      };

      const { data, error } = await supabase
        .from('message_reports')
        .insert(payload)
        .select('*')
        .single();

      return assertSupabaseResult(data, error);
    },
    onSuccess: async (_report, input) => {
      logAnalyticsEvent('message_report_created', {
        league_id: input.leagueId,
        reason: input.reason,
        reported_user_id: input.reportedUserId,
        reporter_user_id: reporterUserId,
      });
      await queryClient.invalidateQueries({
        queryKey: moderationKeys.messageReports(input.leagueId),
      });
    },
  });
}

export function useBlockedUsers(blockerUserId: string | undefined) {
  return useQuery({
    enabled: Boolean(blockerUserId),
    queryFn: async (): Promise<BlockedUser[]> => {
      if (!blockerUserId) {
        return [];
      }

      const { data, error } = await supabase
        .from('user_blocks')
        .select(
          'id, blocker_id, blocked_id, league_id, created_at, blocked_user:users!user_blocks_blocked_id_fkey(id, display_name, avatar_url, is_premium, created_at)',
        )
        .eq('blocker_id', blockerUserId)
        .order('created_at', { ascending: false });

      const rows = assertSupabaseResult(
        data as (UserBlockRow & { blocked_user: PublicBlockedUser | null })[] | null,
        error,
      );

      return rows.map(({ blocked_user: blockedUser, ...block }) => ({
        ...block,
        blockedUser,
      }));
    },
    queryKey: moderationKeys.blockedUsers(blockerUserId),
  });
}

export function useBlockUserMutation(blockerUserId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BlockUserInput | string) => {
      if (!blockerUserId) {
        throw new Error('You must be signed in to block a user.');
      }

      const blockedUserId = typeof input === 'string' ? input : input.blockedUserId;
      const leagueId = typeof input === 'string' ? null : input.leagueId ?? null;

      if (blockedUserId === blockerUserId) {
        throw new Error('You cannot block yourself.');
      }

      const payload: UserBlockInsert = {
        blocked_id: blockedUserId,
        blocker_id: blockerUserId,
        league_id: leagueId,
      };

      const { data, error } = await supabase
        .from('user_blocks')
        .insert(payload)
        .select('id, blocker_id, blocked_id, league_id, created_at')
        .single();

      if (error?.code === '23505') {
        const existing = await supabase
          .from('user_blocks')
          .select('id, blocker_id, blocked_id, league_id, created_at')
          .eq('blocker_id', blockerUserId)
          .eq('blocked_id', blockedUserId)
          .single();

        return assertSupabaseResult(existing.data, existing.error);
      }

      return assertSupabaseResult(data, error);
    },
    onSuccess: async (block) => {
      logAnalyticsEvent('user_blocked', {
        blocked_user_id: block.blocked_id,
        blocker_user_id: blockerUserId,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['league-chat'] }),
        queryClient.invalidateQueries({ queryKey: moderationKeys.blockedUsers(blockerUserId) }),
      ]);
    },
  });
}

export function useUnblockUserMutation(blockerUserId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (blockId: string) => {
      if (!blockerUserId) {
        throw new Error('You must be signed in to unblock a user.');
      }

      const { error } = await supabase
        .from('user_blocks')
        .delete()
        .eq('id', blockId)
        .eq('blocker_id', blockerUserId);

      if (error) {
        throw new Error(error.message);
      }

      return blockId;
    },
    onSuccess: async (blockId) => {
      logAnalyticsEvent('user_unblocked', {
        block_id: blockId,
        blocker_user_id: blockerUserId,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['league-chat'] }),
        queryClient.invalidateQueries({ queryKey: moderationKeys.blockedUsers(blockerUserId) }),
      ]);
    },
  });
}

export function useChatModerationStatus(userId: string | undefined) {
  return useQuery({
    enabled: Boolean(userId),
    queryFn: async (): Promise<ChatModerationStatus> => {
      const { data, error } = await supabase.rpc('get_my_chat_moderation_status');
      const rows = assertSupabaseResult(data as ChatModerationStatus[] | null, error);

      return rows[0] ?? { chat_banned: false, chat_terms_accepted_at: null };
    },
    queryKey: moderationKeys.chatStatus(userId),
  });
}

export function useAcceptChatTermsMutation(userId: string | undefined) {
  const queryClient = useQueryClient();
  const chatStatusQueryKey = moderationKeys.chatStatus(userId);

  return useMutation({
    mutationFn: async () => {
      if (!userId) {
        throw new Error('You must be signed in to accept chat terms.');
      }

      const { data, error } = await supabase.rpc('accept_chat_terms');

      return assertSupabaseResult(data, error);
    },
    onSuccess: async (acceptedAt) => {
      logAnalyticsEvent('chat_terms_accepted', {
        user_id: userId,
      });
      queryClient.setQueryData<ChatModerationStatus | undefined>(
        chatStatusQueryKey,
        (current) => ({
          chat_banned: current?.chat_banned ?? false,
          chat_terms_accepted_at: acceptedAt,
        }),
      );
      await queryClient.refetchQueries({ queryKey: chatStatusQueryKey });
    },
  });
}
