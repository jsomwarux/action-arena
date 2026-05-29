import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  ErrorCode,
  currentEntitlementIOS,
  getAvailablePurchases as getStoreAvailablePurchases,
  getReceiptDataIOS,
  requestReceiptRefreshIOS,
  useIAP,
  type ExpoPurchaseError,
  type Product,
  type Purchase,
} from 'expo-iap';
import { useQueryClient } from '@tanstack/react-query';

import { CURRENT_SEASON_YEAR } from '@/constants/cosmetics';
import { SEASON_PASS_PRODUCT_ID } from '@/constants/iap';
import { supabase } from '@/lib/supabase';

import { seasonPassKeys } from './use-season-pass';

type PurchaseMode = 'purchase' | 'restore';
type ProductFetchStatus = 'idle' | 'loading' | 'loaded' | 'error';

export type SeasonPassPurchaseResult = {
  message: string;
  ok: boolean;
  title: string;
};

type ValidateSeasonPassReceiptResponse = {
  entitlementId?: string;
  error?: string;
  ok?: boolean;
  status?: 'already_entitled' | 'granted';
};

type ValidateSeasonPassReceiptBody = {
  originalTransactionId: string | null;
  productId: string;
  receiptData: string;
  seasonYear: number;
  transactionId: string | null;
  transactionJws: string | null;
};

const STORE_UNAVAILABLE_MESSAGE =
  'Apple In-App Purchase is not available on this build or device. Use a physical iOS development or TestFlight build, or redeem a Season Pass code.';

const VALIDATION_RETRY_MESSAGE =
  'Apple confirmed the purchase, but Action Arena could not validate it yet. Restore purchases after your connection is back.';

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

function userFacingPurchaseError(error: unknown) {
  switch (errorCode(error)) {
    case ErrorCode.AlreadyOwned:
      return 'This Apple ID already owns the Season Pass. Tap Restore Purchases to reconnect it.';
    case ErrorCode.BillingUnavailable:
    case ErrorCode.IapNotAvailable:
    case ErrorCode.FeatureNotSupported:
      return STORE_UNAVAILABLE_MESSAGE;
    case ErrorCode.DeferredPayment:
    case ErrorCode.Pending:
      return 'The purchase is pending approval. The Season Pass will unlock once Apple finishes processing it.';
    case ErrorCode.Interrupted:
      return 'The purchase was interrupted. Try again, or use Restore Purchases if Apple completed it.';
    case ErrorCode.ItemUnavailable:
    case ErrorCode.SkuNotFound:
      return 'The Season Pass product is not available from Apple yet. Confirm the product id in App Store Connect.';
    case ErrorCode.NetworkError:
    case ErrorCode.ServiceDisconnected:
    case ErrorCode.ServiceTimeout:
      return 'The App Store connection failed. Check your network and try again.';
    case ErrorCode.UserCancelled:
      return 'Purchase cancelled.';
    default:
      return error instanceof Error ? error.message : 'The purchase could not be completed.';
  }
}

function purchaseKey(purchase: Purchase) {
  return [
    purchase.productId,
    purchase.id,
    purchase.purchaseToken ?? '',
    String(purchase.transactionDate),
  ].join(':');
}

function isSeasonPassPurchase(purchase: Purchase) {
  return purchase.productId === SEASON_PASS_PRODUCT_ID;
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function iosOriginalTransactionId(purchase: Purchase) {
  return isRecord(purchase) ? nullableString(purchase.originalTransactionIdentifierIOS) : null;
}

async function readReceiptData() {
  if (Platform.OS !== 'ios') {
    throw new Error('Season Pass purchases are only enabled for iOS at launch.');
  }

  const receiptData = await getReceiptDataIOS();

  if (receiptData) {
    return receiptData;
  }

  const refreshedReceiptData = await requestReceiptRefreshIOS();

  if (!refreshedReceiptData) {
    throw new Error('Apple did not return a receipt yet. Try Restore Purchases in a moment.');
  }

  return refreshedReceiptData;
}

function result(ok: boolean, title: string, message: string): SeasonPassPurchaseResult {
  return { message, ok, title };
}

export function useSeasonPassPurchase(
  userId: string | undefined,
  seasonYear = CURRENT_SEASON_YEAR,
) {
  const queryClient = useQueryClient();
  const [storeError, setStoreError] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [productFetchStatus, setProductFetchStatus] = useState<ProductFetchStatus>('idle');
  const processingPurchasesRef = useRef(new Set<string>());
  const returnedPurchaseRef = useRef<string | null>(null);
  const processPurchaseRef = useRef<
    ((purchase: Purchase, mode: PurchaseMode) => Promise<SeasonPassPurchaseResult>) | null
  >(null);

  const {
    connected,
    fetchProducts,
    finishTransaction,
    products,
    requestPurchase,
    restorePurchases,
  } = useIAP({
    onError: (error) => {
      setStoreError(userFacingPurchaseError(error));
      setProductFetchStatus((current) => (current === 'loading' ? 'error' : current));
    },
    onPurchaseError: (error: ExpoPurchaseError) => {
      setIsPurchasing(false);
      setOperationError(userFacingPurchaseError(error));
    },
    onPurchaseSuccess: (purchase) => {
      if (!isSeasonPassPurchase(purchase)) {
        return;
      }

      const key = purchaseKey(purchase);

      if (returnedPurchaseRef.current === key) {
        returnedPurchaseRef.current = null;
        return;
      }

      void processPurchaseRef.current?.(purchase, 'purchase');
    },
  });

  const product = useMemo<Product | null>(
    () => products.find((item) => item.id === SEASON_PASS_PRODUCT_ID) ?? null,
    [products],
  );

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      setStoreError('Season Pass purchases are only enabled for iOS at launch.');
      setProductFetchStatus('loaded');
      return;
    }

    if (!connected || productFetchStatus !== 'idle') {
      return;
    }

    let cancelled = false;

    const loadProduct = async () => {
      setProductFetchStatus('loading');
      try {
        await fetchProducts({ skus: [SEASON_PASS_PRODUCT_ID], type: 'in-app' });

        if (!cancelled) {
          setProductFetchStatus('loaded');
          setStoreError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setProductFetchStatus('error');
          setStoreError(userFacingPurchaseError(error));
        }
      }
    };

    void loadProduct();

    return () => {
      cancelled = true;
    };
  }, [connected, fetchProducts, productFetchStatus]);

  useEffect(() => {
    if (product) {
      setStoreError(null);
      return;
    }

    if (productFetchStatus !== 'loaded') {
      return;
    }

    setStoreError(
      'Season Pass pricing is not available from Apple yet. Confirm the product id in App Store Connect.',
    );
  }, [product, productFetchStatus]);

  const validateReceipt = useCallback(
    async (purchase: Purchase) => {
      const receiptData = await readReceiptData();
      const body: ValidateSeasonPassReceiptBody = {
        originalTransactionId: iosOriginalTransactionId(purchase),
        productId: SEASON_PASS_PRODUCT_ID,
        receiptData,
        seasonYear,
        transactionId: nullableString(purchase.id),
        transactionJws: nullableString(purchase.purchaseToken),
      };

      const { data, error } =
        await supabase.functions.invoke<ValidateSeasonPassReceiptResponse>(
          'validate-season-pass-receipt',
          {
            body,
            method: 'POST',
          },
        );

      if (error) {
        throw new Error(VALIDATION_RETRY_MESSAGE);
      }

      if (!data?.ok) {
        throw new Error(data?.error ?? 'The Season Pass receipt could not be validated.');
      }

      return data;
    },
    [seasonYear],
  );

  const refreshEntitlement = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: seasonPassKeys.pass(userId, seasonYear) }),
      queryClient.invalidateQueries({ queryKey: ['cosmetics', 'mine', userId] }),
    ]);
  }, [queryClient, seasonYear, userId]);

  const processPurchase = useCallback(
    async (purchase: Purchase, mode: PurchaseMode): Promise<SeasonPassPurchaseResult> => {
      if (!isSeasonPassPurchase(purchase)) {
        return result(false, 'No Season Pass found', 'No Season Pass purchase was found.');
      }

      if (purchase.purchaseState === 'pending') {
        const message =
          'The purchase is pending approval. The Season Pass will unlock once Apple finishes processing it.';
        setStatusMessage(message);
        setOperationError(null);
        setIsPurchasing(false);
        return result(false, 'Purchase pending', message);
      }

      if (purchase.purchaseState !== 'purchased') {
        const message =
          'Apple has not marked this purchase complete yet. Try Restore Purchases again in a moment.';
        setStatusMessage(message);
        setOperationError(null);
        setIsPurchasing(false);
        return result(false, 'Purchase still processing', message);
      }

      const key = purchaseKey(purchase);

      if (processingPurchasesRef.current.has(key)) {
        return result(
          false,
          'Purchase already processing',
          'This Season Pass purchase is already being validated.',
        );
      }

      processingPurchasesRef.current.add(key);
      setIsPurchasing(true);
      setOperationError(null);
      setStatusMessage(
        mode === 'restore'
          ? 'Restoring your Season Pass with Apple.'
          : 'Validating your Season Pass with Apple.',
      );

      try {
        await validateReceipt(purchase);
        await finishTransaction({ isConsumable: false, purchase });
        await refreshEntitlement();

        const message = 'Season Pass active. Exclusive drops and analytics are unlocked.';
        setStatusMessage(message);
        return result(
          true,
          mode === 'restore' ? 'Purchases restored' : 'Season Pass unlocked',
          message,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : VALIDATION_RETRY_MESSAGE;
        setOperationError(message);
        setStatusMessage(null);
        return result(false, 'Could not validate purchase', message);
      } finally {
        processingPurchasesRef.current.delete(key);
        setIsPurchasing(false);
      }
    },
    [finishTransaction, refreshEntitlement, validateReceipt],
  );

  useEffect(() => {
    processPurchaseRef.current = processPurchase;
  }, [processPurchase]);

  const purchase = useCallback(async (): Promise<SeasonPassPurchaseResult> => {
    if (!userId) {
      const message = 'Sign in before buying the Season Pass.';
      setOperationError(message);
      return result(false, 'Sign in required', message);
    }

    if (Platform.OS !== 'ios') {
      const message = 'Season Pass purchases are only enabled for iOS at launch.';
      setOperationError(message);
      return result(false, 'Purchases unavailable', message);
    }

    if (!product) {
      const message = storeError ?? STORE_UNAVAILABLE_MESSAGE;
      setOperationError(message);
      return result(false, 'Store unavailable', message);
    }

    setIsPurchasing(true);
    setOperationError(null);
    setStatusMessage('Opening the App Store purchase sheet.');

    try {
      const purchased = await requestPurchase({
        request: {
          apple: {
            appAccountToken: userId,
            sku: SEASON_PASS_PRODUCT_ID,
          },
        },
        type: 'in-app',
      });

      if (purchased && !Array.isArray(purchased) && isSeasonPassPurchase(purchased)) {
        returnedPurchaseRef.current = purchaseKey(purchased);
        return await processPurchase(purchased, 'purchase');
      }

      return result(
        false,
        'Purchase started',
        'Confirm the App Store sheet to finish unlocking the Season Pass.',
      );
    } catch (error) {
      const message = userFacingPurchaseError(error);
      setOperationError(message);
      setStatusMessage(null);
      setIsPurchasing(false);
      return result(false, 'Could not start purchase', message);
    }
  }, [processPurchase, product, requestPurchase, storeError, userId]);

  const restore = useCallback(async (): Promise<SeasonPassPurchaseResult> => {
    if (!userId) {
      const message = 'Sign in before restoring purchases.';
      setOperationError(message);
      return result(false, 'Sign in required', message);
    }

    if (Platform.OS !== 'ios') {
      const message = 'Season Pass restore is only enabled for iOS at launch.';
      setOperationError(message);
      return result(false, 'Restore unavailable', message);
    }

    setIsPurchasing(true);
    setOperationError(null);
    setStatusMessage('Checking Apple for Season Pass purchases.');

    try {
      await restorePurchases({
        alsoPublishToEventListenerIOS: false,
        onlyIncludeActiveItemsIOS: true,
      });

      const availablePurchases = await getStoreAvailablePurchases({
        onlyIncludeActiveItemsIOS: true,
      });
      const restoredPurchase =
        availablePurchases.find(isSeasonPassPurchase) ??
        (await currentEntitlementIOS(SEASON_PASS_PRODUCT_ID));

      if (!restoredPurchase) {
        const message = 'Apple did not find a Season Pass purchase for this Apple ID.';
        setStatusMessage(message);
        setIsPurchasing(false);
        return result(false, 'No purchases found', message);
      }

      return await processPurchase(restoredPurchase, 'restore');
    } catch (error) {
      const message = userFacingPurchaseError(error);
      setOperationError(message);
      setStatusMessage(null);
      setIsPurchasing(false);
      return result(false, 'Restore failed', message);
    }
  }, [processPurchase, restorePurchases, userId]);

  const isLoading =
    productFetchStatus === 'loading' ||
    (Platform.OS === 'ios' && !connected && productFetchStatus === 'idle' && !storeError);

  return {
    error: operationError ?? storeError,
    isLoading,
    isPurchasing,
    message: statusMessage,
    product,
    purchase,
    restore,
  };
}
