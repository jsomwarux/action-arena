import { useMutation, useQueryClient } from '@tanstack/react-query';

import { PUBLIC_USER_SELECT } from '@/constants/public-user-select';
import { supabase } from '@/lib/supabase';
import type { UserUpdate } from '@/types/database';

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
