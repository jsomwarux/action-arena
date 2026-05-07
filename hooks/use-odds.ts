import { useQuery } from '@tanstack/react-query';

import { fetchUpcomingNflOdds, isUsingMockOdds } from '@/lib/odds-api';

export function useUpcomingNflOdds() {
  return useQuery({
    gcTime: 1000 * 60 * 30,
    queryFn: fetchUpcomingNflOdds,
    queryKey: ['odds', 'nfl', 'upcoming', isUsingMockOdds ? 'mock' : 'live'],
    staleTime: 1000 * 60 * 5,
  });
}
