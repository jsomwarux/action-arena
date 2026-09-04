import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { PUBLIC_USER_SELECT } from '@/constants/public-user-select';
import { supabase } from '@/lib/supabase';
import type { UserUpdate } from '@/types/database';

/**
 * The signed-in player's own `users` row.
 *
 * The auth session carries `user_metadata.display_name` from signup, but the
 * `users` table is what Settings writes, so it wins where the two disagree.
 * Callers fall back to metadata when the row has not been read yet.
 */
export function useCurrentUserProfile(userId: string | undefined) {
  return useQuery({
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select(PUBLIC_USER_SELECT)
        .eq('id', userId ?? '')
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
    queryKey: ['user-profile', userId],
    staleTime: 60_000,
  });
}

export function useUpdateUserProfile(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Pick<UserUpdate, 'avatar_url' | 'display_name'>) => {
      if (!userId) {
        throw new Error('You must be signed in to update your profile.');
      }

      const { data, error } = await supabase
        .from('users')
        .update({
          avatar_url: updates.avatar_url?.trim() || null,
          display_name: updates.display_name?.trim(),
        })
        .eq('id', userId)
        .select(PUBLIC_USER_SELECT)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['profile-stats', userId] }),
        queryClient.invalidateQueries({ queryKey: ['leagues', 'mine', userId] }),
      ]);
    },
  });
}
