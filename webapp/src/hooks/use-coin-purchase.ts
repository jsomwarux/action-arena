import { useCallback, useState } from 'react';

import type { CoinPack } from '@/constants/cosmetics';
import type { ArenaCoinProductId } from '@/constants/iap';

// Arena Coin purchases are iOS-only for now; the web build has no store to talk to.

type ProductFetchStatus = 'idle' | 'loading' | 'loaded' | 'error';

export type CoinPurchaseResult = {
  coinBalance?: number;
  message: string;
  ok: boolean;
  title: string;
};

const STORE_UNAVAILABLE_MESSAGE = 'Arena Coin purchases are only enabled for iOS at launch.';

function result(ok: boolean, title: string, message: string, coinBalance?: number): CoinPurchaseResult {
  return { coinBalance, message, ok, title };
}

export function useCoinPurchase(_userId: string | undefined) {
  const [operationError, setOperationError] = useState<string | null>(null);

  const purchase = useCallback(async (_pack: CoinPack): Promise<CoinPurchaseResult> => {
    setOperationError(STORE_UNAVAILABLE_MESSAGE);
    return result(false, 'Purchases unavailable', STORE_UNAVAILABLE_MESSAGE);
  }, []);

  const retryProducts = useCallback(async () => {
    setOperationError(null);
  }, []);

  const productsById: Partial<Record<ArenaCoinProductId, null>> = {};

  return {
    error: operationError ?? STORE_UNAVAILABLE_MESSAGE,
    isLoading: false,
    isPurchasing: false,
    isProductPurchasing: (_productId: string) => false,
    message: null as string | null,
    productFetchStatus: 'loaded' as ProductFetchStatus,
    productsById,
    purchase,
    retryProducts,
  };
}
