import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  ErrorCode,
  getTransactionJwsIOS,
  isTransactionVerifiedIOS,
  useIAP,
  type ExpoPurchaseError,
  type Product,
  type Purchase,
} from 'expo-iap';

import type { CoinPack } from '@/constants/cosmetics';
import { ARENA_COIN_PRODUCT_IDS_LIST, type ArenaCoinProductId } from '@/constants/iap';
import { supabase } from '@/lib/supabase';

type ProductFetchStatus = 'idle' | 'loading' | 'loaded' | 'error';

export type CoinPurchaseResult = {
  coinBalance?: number;
  message: string;
  ok: boolean;
  title: string;
};

type ValidateCoinPurchaseResponse = {
  coinAmount?: number;
  coinBalance?: number;
  error?: string;
  granted?: boolean;
  ok?: boolean;
  status?: 'already_granted' | 'granted';
};

type ValidateCoinPurchaseBody = {
  originalTransactionId: string | null;
  productId: ArenaCoinProductId;
  receiptData: null;
  transactionId: string | null;
  transactionJws: string | null;
};

const STORE_UNAVAILABLE_MESSAGE =
  'Apple In-App Purchase is not available on this build or device. Use a physical iOS development or TestFlight build.';
const PRODUCT_UNAVAILABLE_MESSAGE =
  'Arena Coin pricing is not available from Apple yet. Confirm the coin pack product IDs in App Store Connect.';
const VALIDATION_RETRY_MESSAGE =
  'Apple confirmed the purchase, but Action Arena could not validate the coin grant yet. Reopen the Coin Store after your connection is back.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function errorCode(error: unknown) {
  if (!isRecord(error)) {
    return null;
  }

  const code = error.code;
  return typeof code === 'string' ? code : null;
}

function isStatusOnlyError(error: unknown) {
  return (
    errorCode(error) === ErrorCode.UserCancelled ||
    errorCode(error) === ErrorCode.DeferredPayment ||
    errorCode(error) === ErrorCode.Pending
  );
}

function userFacingPurchaseError(error: unknown) {
  switch (errorCode(error)) {
    case ErrorCode.BillingUnavailable:
    case ErrorCode.IapNotAvailable:
    case ErrorCode.FeatureNotSupported:
      return STORE_UNAVAILABLE_MESSAGE;
    case ErrorCode.DeferredPayment:
    case ErrorCode.Pending:
      return 'The purchase is pending approval. Arena Coins will be granted once Apple finishes processing it.';
    case ErrorCode.Interrupted:
      return 'The purchase was interrupted. Try again after Apple finishes processing.';
    case ErrorCode.ItemUnavailable:
    case ErrorCode.SkuNotFound:
      return PRODUCT_UNAVAILABLE_MESSAGE;
    case ErrorCode.NetworkError:
    case ErrorCode.ServiceDisconnected:
    case ErrorCode.ServiceTimeout:
      return 'The App Store connection failed. Check your network and try again.';
    case ErrorCode.UserCancelled:
      return 'Purchase cancelled.';
    default:
      return error instanceof Error ? error.message : 'The coin purchase could not be completed.';
  }
}

function purchaseKey(purchase: Purchase) {
  return [
    purchase.productId,
    purchase.id,
    purchase.purchaseToken ?? '',
    String(isRecord(purchase) ? purchase.transactionDate : ''),
  ].join(':');
}

function isCoinPurchase(purchase: Purchase): purchase is Purchase & { productId: ArenaCoinProductId } {
  return ARENA_COIN_PRODUCT_IDS_LIST.some((productId) => productId === purchase.productId);
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function iosOriginalTransactionId(purchase: Purchase) {
  return isRecord(purchase) ? nullableString(purchase.originalTransactionIdentifierIOS) : null;
}

function result(ok: boolean, title: string, message: string, coinBalance?: number): CoinPurchaseResult {
  return { coinBalance, message, ok, title };
}

export function useCoinPurchase(userId: string | undefined) {
  const queryClient = useQueryClient();
  const [storeError, setStoreError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPurchasingProductId, setIsPurchasingProductId] = useState<string | null>(null);
  const [productFetchStatus, setProductFetchStatus] = useState<ProductFetchStatus>('idle');
  const processingPurchasesRef = useRef(new Set<string>());
  const returnedPurchaseRef = useRef<string | null>(null);
  const processPurchaseRef = useRef<((purchase: Purchase) => Promise<CoinPurchaseResult>) | null>(
    null,
  );

  const { connected, fetchProducts, finishTransaction, products, requestPurchase } = useIAP({
    onError: (error) => {
      const message = userFacingPurchaseError(error);
      setStoreError(message);
      setStatusMessage(null);
      setProductFetchStatus((current) => (current === 'loading' ? 'error' : current));
    },
    onPurchaseError: (error: ExpoPurchaseError) => {
      const message = userFacingPurchaseError(error);
      setIsPurchasingProductId(null);
      if (isStatusOnlyError(error)) {
        setStatusMessage(message);
        setOperationError(null);
      } else {
        setOperationError(message);
        setStatusMessage(null);
      }
    },
    onPurchaseSuccess: (purchase) => {
      if (!isCoinPurchase(purchase)) {
        return;
      }

      const key = purchaseKey(purchase);

      if (returnedPurchaseRef.current === key) {
        returnedPurchaseRef.current = null;
        return;
      }

      void processPurchaseRef.current?.(purchase);
    },
  });

  const productsById = useMemo(() => {
    return products.reduce<Partial<Record<ArenaCoinProductId, Product>>>((accumulator, product) => {
      if (ARENA_COIN_PRODUCT_IDS_LIST.some((productId) => productId === product.id)) {
        accumulator[product.id as ArenaCoinProductId] = product;
      }
      return accumulator;
    }, {});
  }, [products]);

  const loadProducts = useCallback(async () => {
    if (Platform.OS !== 'ios') {
      setStoreError('Arena Coin purchases are only enabled for iOS at launch.');
      setProductFetchStatus('loaded');
      return;
    }

    if (!connected) {
      setStoreError(STORE_UNAVAILABLE_MESSAGE);
      setProductFetchStatus('error');
      return;
    }

    setProductFetchStatus('loading');
    try {
      await fetchProducts({ skus: [...ARENA_COIN_PRODUCT_IDS_LIST], type: 'in-app' });
      setProductFetchStatus('loaded');
      setStoreError(null);
    } catch (error) {
      setProductFetchStatus('error');
      setStoreError(userFacingPurchaseError(error));
    }
  }, [connected, fetchProducts]);

  useEffect(() => {
    if (productFetchStatus !== 'idle') {
      return;
    }

    void loadProducts();
  }, [loadProducts, productFetchStatus]);

  useEffect(() => {
    if (productFetchStatus !== 'loaded') {
      return;
    }

    const allProductsLoaded = ARENA_COIN_PRODUCT_IDS_LIST.every(
      (productId) => productsById[productId],
    );

    setStoreError(allProductsLoaded ? null : PRODUCT_UNAVAILABLE_MESSAGE);
  }, [productFetchStatus, productsById]);

  const validatePurchase = useCallback(async (purchase: Purchase & { productId: ArenaCoinProductId }) => {
    if (Platform.OS !== 'ios') {
      throw new Error('Arena Coin purchases are only enabled for iOS at launch.');
    }

    const isVerified = await isTransactionVerifiedIOS(purchase.productId);

    if (!isVerified) {
      throw new Error('Apple has not verified this Arena Coin transaction yet.');
    }

    const transactionJws =
      nullableString(purchase.purchaseToken) ?? (await getTransactionJwsIOS(purchase.productId));

    if (!transactionJws) {
      throw new Error('Apple did not return a readable Arena Coin transaction yet.');
    }

    const body: ValidateCoinPurchaseBody = {
      originalTransactionId: iosOriginalTransactionId(purchase),
      productId: purchase.productId,
      receiptData: null,
      transactionId: nullableString(purchase.id),
      transactionJws,
    };

    const { data, error } = await supabase.functions.invoke<ValidateCoinPurchaseResponse>(
      'validate-coin-purchase',
      {
        body,
        method: 'POST',
      },
    );

    if (error) {
      throw new Error(VALIDATION_RETRY_MESSAGE);
    }

    if (!data?.ok || typeof data.coinBalance !== 'number') {
      throw new Error(data?.error ?? 'The Arena Coin purchase could not be validated.');
    }

    return data;
  }, []);

  const refreshCoinBalance = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['cosmetics', 'mine', userId] });
  }, [queryClient, userId]);

  const processPurchase = useCallback(
    async (purchase: Purchase): Promise<CoinPurchaseResult> => {
      if (!isCoinPurchase(purchase)) {
        return result(false, 'No coin pack found', 'No Arena Coin purchase was found.');
      }

      if (purchase.purchaseState === 'pending') {
        const message =
          'The purchase is pending approval. Arena Coins will be granted once Apple finishes processing it.';
        setStatusMessage(message);
        setOperationError(null);
        setIsPurchasingProductId(null);
        return result(false, 'Purchase pending', message);
      }

      if (purchase.purchaseState !== 'purchased') {
        const message =
          'Apple has not marked this coin purchase complete yet. Try again in a moment.';
        setStatusMessage(message);
        setOperationError(null);
        setIsPurchasingProductId(null);
        return result(false, 'Purchase still processing', message);
      }

      const key = purchaseKey(purchase);

      if (processingPurchasesRef.current.has(key)) {
        return result(false, 'Purchase already processing', 'This coin purchase is already being validated.');
      }

      processingPurchasesRef.current.add(key);
      setIsPurchasingProductId(purchase.productId);
      setOperationError(null);
      setStatusMessage('Validating your Arena Coin purchase with Apple.');

      try {
        const data = await validatePurchase(purchase);
        await finishTransaction({ isConsumable: true, purchase });
        await refreshCoinBalance();

        const message = `${(data.coinAmount ?? 0).toLocaleString()} Arena Coins added to your locker balance.`;
        setStatusMessage(message);
        return result(true, 'Arena Coins added', message, data.coinBalance);
      } catch (error) {
        const message = error instanceof Error ? error.message : VALIDATION_RETRY_MESSAGE;
        setOperationError(message);
        setStatusMessage(null);
        return result(false, 'Could not validate purchase', message);
      } finally {
        processingPurchasesRef.current.delete(key);
        setIsPurchasingProductId(null);
      }
    },
    [finishTransaction, refreshCoinBalance, validatePurchase],
  );

  useEffect(() => {
    processPurchaseRef.current = processPurchase;
  }, [processPurchase]);

  const purchase = useCallback(
    async (pack: CoinPack): Promise<CoinPurchaseResult> => {
      setOperationError(null);
      setStatusMessage(null);

      if (!userId) {
        const message = 'Sign in before buying Arena Coins.';
        setOperationError(message);
        return result(false, 'Sign in required', message);
      }

      if (Platform.OS !== 'ios') {
        const message = 'Arena Coin purchases are only enabled for iOS at launch.';
        setOperationError(message);
        return result(false, 'Purchases unavailable', message);
      }

      if (!productsById[pack.productId]) {
        const message = PRODUCT_UNAVAILABLE_MESSAGE;
        setStoreError(message);
        return result(false, 'Pricing unavailable', message);
      }

      setIsPurchasingProductId(pack.productId);
      setStatusMessage('Opening the App Store purchase sheet.');

      try {
        const purchased = await requestPurchase({
          request: {
            apple: {
              appAccountToken: userId,
              sku: pack.productId,
            },
          },
          type: 'in-app',
        });

        if (purchased && !Array.isArray(purchased) && isCoinPurchase(purchased)) {
          returnedPurchaseRef.current = purchaseKey(purchased);
          return await processPurchase(purchased);
        }

        return result(
          false,
          'Purchase started',
          'Confirm the App Store sheet to finish adding Arena Coins.',
        );
      } catch (error) {
        const message = userFacingPurchaseError(error);
        setIsPurchasingProductId(null);
        if (isStatusOnlyError(error)) {
          setStatusMessage(message);
          setOperationError(null);
          return result(false, 'Purchase pending', message);
        }

        setOperationError(message);
        setStatusMessage(null);
        return result(false, 'Could not start purchase', message);
      }
    },
    [processPurchase, productsById, requestPurchase, userId],
  );

  const retryProducts = useCallback(async () => {
    setStoreError(null);
    setProductFetchStatus('idle');
  }, []);

  const isLoading =
    productFetchStatus === 'loading' ||
    (Platform.OS === 'ios' && !connected && productFetchStatus === 'idle' && !storeError);

  return {
    error: operationError ?? storeError,
    isLoading,
    isPurchasing: Boolean(isPurchasingProductId),
    isProductPurchasing: (productId: string) => isPurchasingProductId === productId,
    message: statusMessage,
    productFetchStatus,
    productsById,
    purchase,
    retryProducts,
  };
}
