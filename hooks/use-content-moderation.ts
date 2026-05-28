import { useMutation, useQueryClient } from '@tanstack/react-query';

import { logAnalyticsEvent } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import type {
  ContentReportInsert,
  ContentReportTargetType,
  Json,
  UserBlockInsert,
} from '@/types/database';

export type ReportContentInput = {
  contentSnapshot: Json;
  details?: string;
  leagueId?: string;
  reason?: string;
  reportedUserId?: string;
  targetId: string;
  targetType: ContentReportTargetType;
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

export function useBlockUserMutation(blockerUserId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (blockedUserId: string) => {
      if (!blockerUserId) {
        throw new Error('You must be signed in to block a user.');
      }

      if (blockedUserId === blockerUserId) {
        throw new Error('You cannot block yourself.');
      }

      const payload: UserBlockInsert = {
        blocked_user_id: blockedUserId,
        blocker_user_id: blockerUserId,
      };

      const { data, error } = await supabase
        .from('user_blocks')
        .upsert(payload, {
          onConflict: 'blocker_user_id,blocked_user_id',
        })
        .select('*')
        .single();

      return assertSupabaseResult(data, error);
    },
    onSuccess: async (block) => {
      logAnalyticsEvent('user_blocked', {
        blocked_user_id: block.blocked_user_id,
        blocker_user_id: blockerUserId,
      });
      await queryClient.invalidateQueries({ queryKey: ['league-chat'] });
    },
  });
}
