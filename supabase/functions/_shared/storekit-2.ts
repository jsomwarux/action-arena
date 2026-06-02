export type ApplePurchase = {
  cancellationDate: string | null;
  originalTransactionId: string | null;
  productId: string | null;
  purchaseDateMs: string | null;
  transactionId: string | null;
};

export type StoreKitTransaction = {
  bundleId: string | null;
  environment: string | null;
  originalTransactionId: string | null;
  productId: string | null;
  purchaseDateMs: string | null;
  revocationDateMs: string | null;
  transactionId: string | null;
};

type AppleReceiptValidation = {
  bundleId: string | null;
  environment: string | null;
  purchases: ApplePurchase[];
  status: number;
};

export type StoreKitPurchaseVerification = {
  environment: string | null;
  purchase: ApplePurchase;
};

const productionVerifyReceiptUrl = 'https://buy.itunes.apple.com/verifyReceipt';
const sandboxVerifyReceiptUrl = 'https://sandbox.itunes.apple.com/verifyReceipt';

export class PublicFunctionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'PublicFunctionError';
    this.status = status;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export function nullableString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseApplePurchase(value: unknown): ApplePurchase | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    cancellationDate:
      stringField(value, 'cancellation_date') ?? stringField(value, 'cancellation_date_ms'),
    originalTransactionId: stringField(value, 'original_transaction_id'),
    productId: stringField(value, 'product_id'),
    purchaseDateMs: stringField(value, 'purchase_date_ms'),
    transactionId: stringField(value, 'transaction_id'),
  };
}

function parseApplePurchases(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const purchase = parseApplePurchase(item);
    return purchase ? [purchase] : [];
  });
}

function parseAppleResponse(value: unknown): AppleReceiptValidation {
  if (!isRecord(value) || typeof value.status !== 'number') {
    throw new Error('Apple returned an unreadable receipt response.');
  }

  const receipt = isRecord(value.receipt) ? value.receipt : null;
  const receiptPurchases = receipt ? parseApplePurchases(receipt.in_app) : [];
  const latestReceiptPurchases = parseApplePurchases(value.latest_receipt_info);

  return {
    bundleId: receipt ? stringField(receipt, 'bundle_id') : null,
    environment: stringField(value, 'environment'),
    purchases: [...receiptPurchases, ...latestReceiptPurchases],
    status: value.status,
  };
}

async function callAppleVerifyReceipt(endpoint: string, receiptData: string, sharedSecret: string) {
  const response = await fetch(endpoint, {
    body: JSON.stringify({
      'exclude-old-transactions': true,
      'receipt-data': receiptData,
      password: sharedSecret,
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Apple receipt endpoint returned HTTP ${response.status}`);
  }

  return parseAppleResponse(await response.json());
}

async function verifyReceiptWithApple(receiptData: string, sharedSecret: string) {
  let validation = await callAppleVerifyReceipt(
    productionVerifyReceiptUrl,
    receiptData,
    sharedSecret,
  );

  if (validation.status === 21007) {
    validation = await callAppleVerifyReceipt(sandboxVerifyReceiptUrl, receiptData, sharedSecret);
  } else if (validation.status === 21008) {
    validation = await callAppleVerifyReceipt(
      productionVerifyReceiptUrl,
      receiptData,
      sharedSecret,
    );
  }

  if (validation.status !== 0) {
    throw new PublicFunctionError('Apple did not accept this purchase receipt.');
  }

  return validation;
}

function findApplePurchase(
  validation: AppleReceiptValidation,
  expectedProductId: string,
  transactionId: string | null,
  originalTransactionId: string | null,
) {
  const candidates = validation.purchases.filter(
    (purchase) => purchase.productId === expectedProductId && !purchase.cancellationDate,
  );

  if (candidates.length === 0) {
    return null;
  }

  const transactionMatches = candidates.find((purchase) => {
    const ids = [purchase.transactionId, purchase.originalTransactionId].filter(
      (value): value is string => Boolean(value),
    );

    return (
      (transactionId !== null && ids.includes(transactionId)) ||
      (originalTransactionId !== null && ids.includes(originalTransactionId))
    );
  });

  return transactionMatches ?? candidates[candidates.length - 1] ?? null;
}

function numberOrStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];

  if (typeof value === 'string' && value.length > 0) {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return null;
}

function decodeBase64UrlJson(segment: string) {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const decoded = atob(padded);
  return JSON.parse(decoded) as unknown;
}

export function parseStoreKitTransactionJws(transactionJws: string): StoreKitTransaction {
  const payloadSegment = transactionJws.split('.')[1];

  if (!payloadSegment) {
    throw new PublicFunctionError('Apple did not return a readable StoreKit transaction.');
  }

  const payload = decodeBase64UrlJson(payloadSegment);

  if (!isRecord(payload)) {
    throw new PublicFunctionError('Apple did not return a readable StoreKit transaction.');
  }

  return {
    bundleId: stringField(payload, 'bundleId'),
    environment: stringField(payload, 'environment'),
    originalTransactionId: numberOrStringField(payload, 'originalTransactionId'),
    productId: stringField(payload, 'productId'),
    purchaseDateMs: numberOrStringField(payload, 'purchaseDate'),
    revocationDateMs: numberOrStringField(payload, 'revocationDate'),
    transactionId: numberOrStringField(payload, 'transactionId'),
  };
}

function applePurchaseFromStoreKitTransaction({
  expectedBundleId,
  expectedProductId,
  originalTransactionId,
  transaction,
  transactionId,
}: {
  expectedBundleId: string;
  expectedProductId: string;
  originalTransactionId: string | null;
  transaction: StoreKitTransaction;
  transactionId: string | null;
}): ApplePurchase {
  if (transaction.bundleId !== expectedBundleId) {
    throw new PublicFunctionError('StoreKit transaction is not for this app.');
  }

  if (transaction.productId !== expectedProductId) {
    throw new PublicFunctionError('StoreKit transaction is not for this product.');
  }

  if (transaction.revocationDateMs) {
    throw new PublicFunctionError('This Apple purchase is no longer active.');
  }

  const transactionIds = [transaction.transactionId, transaction.originalTransactionId].filter(
    (value): value is string => Boolean(value),
  );
  const requestIds = [transactionId, originalTransactionId].filter((value): value is string =>
    Boolean(value),
  );

  if (
    transactionIds.length > 0 &&
    requestIds.length > 0 &&
    !requestIds.some((requestId) => transactionIds.includes(requestId))
  ) {
    throw new PublicFunctionError('StoreKit transaction does not match this request.');
  }

  return {
    cancellationDate: null,
    originalTransactionId: transaction.originalTransactionId,
    productId: transaction.productId,
    purchaseDateMs: transaction.purchaseDateMs,
    transactionId: transaction.transactionId,
  };
}

export async function verifyStoreKitPurchase({
  expectedBundleId,
  expectedProductId,
  originalTransactionId,
  receiptData,
  sharedSecret,
  transactionId,
  transactionJws,
}: {
  expectedBundleId: string;
  expectedProductId: string;
  originalTransactionId: string | null;
  receiptData: string | null;
  sharedSecret: string | null;
  transactionId: string | null;
  transactionJws: string | null;
}): Promise<StoreKitPurchaseVerification> {
  if (receiptData) {
    if (!sharedSecret) {
      throw new Error('Missing Apple IAP shared secret.');
    }

    const validation = await verifyReceiptWithApple(receiptData, sharedSecret);

    if (validation.bundleId !== expectedBundleId) {
      throw new PublicFunctionError('Receipt is not for this app.');
    }

    const purchase = findApplePurchase(
      validation,
      expectedProductId,
      transactionId,
      originalTransactionId,
    );

    if (!purchase) {
      throw new PublicFunctionError('Apple did not return an active purchase for this product.');
    }

    return {
      environment: validation.environment,
      purchase,
    };
  }

  if (transactionJws) {
    const transaction = parseStoreKitTransactionJws(transactionJws);
    return {
      environment: transaction.environment,
      purchase: applePurchaseFromStoreKitTransaction({
        expectedBundleId,
        expectedProductId,
        originalTransactionId,
        transaction,
        transactionId,
      }),
    };
  }

  throw new PublicFunctionError('Receipt or StoreKit transaction is required.');
}

export function applePurchaseDate(value: string | null) {
  if (!value) {
    return null;
  }

  const milliseconds = Number(value);

  if (!Number.isFinite(milliseconds)) {
    return null;
  }

  return new Date(milliseconds).toISOString();
}
