import { useMutation, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

type DeleteAccountResponse = {
  deletedUserId?: string;
  ok?: boolean;
};

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      if (!session) {
        throw new Error('You must be signed in to delete your account.');
      }

      const { data, error } = await supabase.functions.invoke<DeleteAccountResponse>(
        'delete-account',
        {
          body: {},
          method: 'POST',
        },
      );

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.ok) {
        throw new Error('Account deletion did not complete.');
      }

      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });

      if (signOutError) {
        throw new Error(signOutError.message);
      }

      return data;
    },
    onSettled: () => {
      queryClient.clear();
    },
  });
}
