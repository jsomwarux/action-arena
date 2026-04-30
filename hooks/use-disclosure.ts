import type { User } from '@supabase/supabase-js';
import { useMutation } from '@tanstack/react-query';

import { ACTION_ARENA_DISCLOSURE_METADATA_KEY } from '@/constants/disclosure';
import { supabase } from '@/lib/supabase';

function metadataFor(user: User | null | undefined) {
  return user?.user_metadata as Record<string, unknown> | undefined;
}

export function hasSeenActionArenaDisclosure(user: User | null | undefined) {
  const metadata = metadataFor(user);
  return typeof metadata?.[ACTION_ARENA_DISCLOSURE_METADATA_KEY] === 'string';
}

export function useAcknowledgeActionArenaDisclosure() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.updateUser({
        data: {
          [ACTION_ARENA_DISCLOSURE_METADATA_KEY]: new Date().toISOString(),
        },
      });

      if (error) {
        throw error;
      }
    },
  });
}
