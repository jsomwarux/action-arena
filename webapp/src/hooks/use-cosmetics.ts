import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { COSMETIC_ITEMS, SEASON_PASS_COSMETICS } from '@/constants/cosmetics';
import { logAnalyticsEvent } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import type {
  CosmeticCatalogRow,
  EquippedCosmeticsByCategory,
  UserCosmeticRow,
} from '@/types/database';

export type UserCosmeticsState = {
  catalog: CosmeticCatalogRow[];
  coinBalance: number;
  equippedByCategory: EquippedCosmeticsByCategory;
  ownedByItemId: Record<string, UserCosmeticRow>;
  rows: UserCosmeticRow[];
};

const cosmeticsKeys = {
  equipped: (userIds: string[]) => ['cosmetics', 'equipped', [...userIds].sort().join('|')] as const,
  mine: (userId: string | undefined) => ['cosmetics', 'mine', userId] as const,
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

function toOwnedMap(rows: UserCosmeticRow[]) {
  return rows.reduce<Record<string, UserCosmeticRow>>((accumulator, row) => {
    accumulator[row.item_id] = row;
    return accumulator;
  }, {});
}

function toEquippedMap(rows: UserCosmeticRow[]) {
  return rows
    .filter((row) => row.is_equipped)
    .reduce<EquippedCosmeticsByCategory>((accumulator, row) => {
      accumulator[row.category] = row;
      return accumulator;
    }, {});
}

export function useUserCosmetics(userId: string | undefined) {
  return useQuery({
    enabled: Boolean(userId),
    queryFn: async (): Promise<UserCosmeticsState> => {
      if (!userId) {
        return {
          catalog: [],
          coinBalance: 0,
          equippedByCategory: {},
          ownedByItemId: {},
          rows: [],
        };
      }

      const [coinBalanceResult, cosmeticsResult, catalogResult] = await Promise.all([
        supabase.rpc('get_my_arena_coin_balance'),
        supabase.from('user_cosmetics').select('*').eq('user_id', userId).order('purchased_at'),
        supabase.from('cosmetic_catalog').select('*').order('category').order('coin_cost'),
      ]);

      const coinBalance = assertSupabaseResult(
        coinBalanceResult.data as number | null,
        coinBalanceResult.error,
      );
      const rows = assertSupabaseResult(
        cosmeticsResult.data as UserCosmeticRow[] | null,
        cosmeticsResult.error,
      );
      const catalog = assertSupabaseResult(
        catalogResult.data as CosmeticCatalogRow[] | null,
        catalogResult.error,
      );

      return {
        catalog,
        coinBalance,
        equippedByCategory: toEquippedMap(rows),
        ownedByItemId: toOwnedMap(rows),
        rows,
      };
    },
    queryKey: cosmeticsKeys.mine(userId),
  });
}

export function useEquippedCosmeticsForUsers(userIds: (string | null | undefined)[]) {
  const resolvedIds = [...new Set(userIds.filter((id): id is string => Boolean(id)))];

  return useQuery({
    enabled: resolvedIds.length > 0,
    queryFn: async (): Promise<Record<string, EquippedCosmeticsByCategory>> => {
      if (resolvedIds.length === 0) return {};

      const { data, error } = await supabase
        .from('user_cosmetics')
        .select('*')
        .eq('is_equipped', true)
        .in('user_id', resolvedIds);

      const rows = assertSupabaseResult(data as UserCosmeticRow[] | null, error);
      return rows.reduce<Record<string, EquippedCosmeticsByCategory>>((accumulator, row) => {
        accumulator[row.user_id] = {
          ...(accumulator[row.user_id] ?? {}),
          [row.category]: row,
        };
        return accumulator;
      }, {});
    },
    queryKey: cosmeticsKeys.equipped(resolvedIds),
  });
}

export function usePurchaseCosmeticMutation(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await supabase.rpc('purchase_cosmetic', {
        p_item_id: itemId,
      });
      return assertSupabaseResult(data, error);
    },
    onSuccess: async (_id, itemId) => {
      const item =
        COSMETIC_ITEMS.find((candidate) => candidate.id === itemId) ??
        SEASON_PASS_COSMETICS.find((candidate) => candidate.id === itemId);
      logAnalyticsEvent('cosmetic_purchased', {
        category: item?.category,
        coin_cost: item?.cost,
        item_id: itemId,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: cosmeticsKeys.mine(userId) }),
        queryClient.invalidateQueries({ queryKey: ['profile-stats', userId] }),
      ]);
    },
  });
}

export function useEquipCosmeticMutation(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const { data, error } = await supabase.rpc('equip_cosmetic', {
        p_item_id: itemId,
      });
      return assertSupabaseResult(data, error);
    },
    onSuccess: async (_id, itemId) => {
      const item =
        COSMETIC_ITEMS.find((candidate) => candidate.id === itemId) ??
        SEASON_PASS_COSMETICS.find((candidate) => candidate.id === itemId);
      logAnalyticsEvent('cosmetic_equipped', {
        category: item?.category,
        item_id: itemId,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: cosmeticsKeys.mine(userId) }),
        queryClient.invalidateQueries({ queryKey: cosmeticsKeys.equipped(userId ? [userId] : []) }),
        queryClient.invalidateQueries({ queryKey: ['leaderboard', userId] }),
        queryClient.invalidateQueries({ queryKey: ['profile-stats', userId] }),
      ]);
    },
  });
}
