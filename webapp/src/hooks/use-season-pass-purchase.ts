import { useCallback, useState } from 'react';

import { CURRENT_SEASON_YEAR } from '@/constants/cosmetics';

// Season Pass purchases are iOS-only for now; the web build has no store to talk to.

export type SeasonPassPurchaseResult = {
  message: string;
  ok: boolean;
  title: string;
};

const STORE_UNAVAILABLE_MESSAGE =
  'Season Pass purchases are only enabled for iOS at launch. Redeem a Season Pass code instead.';

function result(ok: boolean, title: string, message: string): SeasonPassPurchaseResult {
  return { message, ok, title };
}

export function useSeasonPassPurchase(
  _userId: string | undefined,
  _seasonYear = CURRENT_SEASON_YEAR,
) {
  const [operationError, setOperationError] = useState<string | null>(null);

  const purchase = useCallback(async (): Promise<SeasonPassPurchaseResult> => {
    setOperationError(STORE_UNAVAILABLE_MESSAGE);
    return result(false, 'Purchases unavailable', STORE_UNAVAILABLE_MESSAGE);
  }, []);

  const restore = useCallback(async (): Promise<SeasonPassPurchaseResult> => {
    setOperationError(STORE_UNAVAILABLE_MESSAGE);
    return result(false, 'Restore unavailable', STORE_UNAVAILABLE_MESSAGE);
  }, []);

  return {
    error: operationError ?? STORE_UNAVAILABLE_MESSAGE,
    isLoading: false,
    isPurchasing: false,
    message: null as string | null,
    product: null,
    purchase,
    restore,
  };
}
