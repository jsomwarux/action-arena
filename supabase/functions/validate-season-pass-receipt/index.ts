import { createClient } from 'jsr:@supabase/supabase-js@2';

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type CosmeticCatalogRow = {
  category: string;
  is_season_pass_exclusive: boolean;
  item_id: string;
};

type SeasonPassRow = {
  id: string;
  source: string;
};

type SeasonPassInsert = {
  iap_environment?: string | null;
  iap_original_transaction_id?: string | null;
  iap_product_id?: string | null;
  iap_purchase_date?: string | null;
  iap_transaction_id?: string | null;
  receipt_validated_at?: string | null;
  redeemed_code?: string | null;
  season_year: number;
  source?: string;
  user_id: string;
};

type SeasonPassUpdate = Partial<Omit<SeasonPassInsert, 'season_year' | 'user_id'>>;

type UserCosmeticInsert = {
  category: string;
  item_id: string;
  metadata?: Json;
  user_id: string;
};

type SeasonPassReceiptDatabase = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: Record<string, never>;
    Tables: {
      cosmetic_catalog: {
        Insert: never;
        Relationships: [];
        Row: CosmeticCatalogRow;
        Update: never;
      };
      season_passes: {
        Insert: SeasonPassInsert;
        Relationships: [];
        Row: SeasonPassRow;
        Update: SeasonPassUpdate;
      };
      user_cosmetics: {
        Insert: UserCosmeticInsert;
        Relationships: [];
        Row: never;
        Update: never;
      };
    };
    Views: Record<string, never>;
  };
};

type ParsedRequestBody = {
  originalTransactionId: string | null;
  productId: string;
  receiptData: string;
  seasonYear: number;
  transactionId: string | null;
  transactionJws: string | null;
};

type ApplePurchase = {
  cancellationDate: string | null;
  originalTransactionId: string | null;
  productId: string | null;
  purchaseDateMs: string | null;
  transactionId: string | null;
};

type AppleReceiptValidation = {
  bundleId: string | null;
  environment: string | null;
  purchases: ApplePurchase[];
  status: number;
};

const productionVerifyReceiptUrl = 'https://buy.itunes.apple.com/verifyReceipt';
const sandboxVerifyReceiptUrl = 'https://sandbox.itunes.apple.com/verifyReceipt';
const fallbackBundleIdentifier = 'com.actionarena.app';
const jsonHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

class PublicFunctionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'PublicFunctionError';
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function bearerToken(request: Request) {
  const header = request.headers.get('Authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    headers: jsonHeaders,
    status,
  });
}

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getOptionalEnv(name: string, fallback: string) {
  const value = Deno.env.get(name);
  return value && value.length > 0 ? value : fallback;
}

async function readRequestBody(request: Request): Promise<ParsedRequestBody> {
  let body: unknown;

  try {
    body = await request.json();
  } catch (_error) {
    throw new PublicFunctionError('Invalid receipt request.');
  }

  if (!isRecord(body)) {
    throw new PublicFunctionError('Invalid receipt request.');
  }

  const receiptData = stringField(body, 'receiptData');
  const productId = stringField(body, 'productId');
  const rawSeasonYear = body.seasonYear;
  const seasonYear =
    typeof rawSeasonYear === 'number'
      ? rawSeasonYear
      : typeof rawSeasonYear === 'string'
        ? Number(rawSeasonYear)
        : NaN;

  if (!receiptData || !productId || !Number.isInteger(seasonYear)) {
    throw new PublicFunctionError('Receipt, product, and season year are required.');
  }

  return {
    originalTransactionId: nullableString(body.originalTransactionId),
    productId,
    receiptData,
    seasonYear,
    transactionId: nullableString(body.transactionId),
    transactionJws: nullableString(body.transactionJws),
  };
}

function parseApplePurchase(value: unknown): ApplePurchase | null {
  if (!isRecord(value)) {
    return null;
  }

  return {
    cancellationDate: stringField(value, 'cancellation_date') ?? stringField(value, 'cancellation_date_ms'),
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

async function callAppleVerifyReceipt(
  endpoint: string,
  receiptData: string,
  sharedSecret: string,
) {
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
    validation = await callAppleVerifyReceipt(productionVerifyReceiptUrl, receiptData, sharedSecret);
  }

  if (validation.status !== 0) {
    throw new PublicFunctionError('Apple did not accept this Season Pass receipt.');
  }

  return validation;
}

function findSeasonPassPurchase(
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

function applePurchaseDate(value: string | null) {
  if (!value) {
    return null;
  }

  const milliseconds = Number(value);

  if (!Number.isFinite(milliseconds)) {
    return null;
  }

  return new Date(milliseconds).toISOString();
}

function createSupabaseClient() {
  return createClient<SeasonPassReceiptDatabase>(
    getRequiredEnv('SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

async function grantSeasonPassEntitlement({
  environment,
  expectedProductId,
  purchase,
  seasonYear,
  supabase,
  userId,
}: {
  environment: string | null;
  expectedProductId: string;
  purchase: ApplePurchase;
  seasonYear: number;
  supabase: ReturnType<typeof createSupabaseClient>;
  userId: string;
}) {
  const receiptMetadata: SeasonPassUpdate = {
    iap_environment: environment,
    iap_original_transaction_id: purchase.originalTransactionId,
    iap_product_id: expectedProductId,
    iap_purchase_date: applePurchaseDate(purchase.purchaseDateMs),
    iap_transaction_id: purchase.transactionId,
    receipt_validated_at: new Date().toISOString(),
  };

  const { data: existingPass, error: existingPassError } = await supabase
    .from('season_passes')
    .select('id, source')
    .eq('user_id', userId)
    .eq('season_year', seasonYear)
    .maybeSingle();

  if (existingPassError) {
    throw new Error(existingPassError.message);
  }

  let entitlementId = existingPass?.id ?? null;

  if (existingPass) {
    const { error: updateError } = await supabase
      .from('season_passes')
      .update(receiptMetadata)
      .eq('id', existingPass.id);

    if (updateError) {
      throw new Error(updateError.message);
    }
  } else {
    const { data: insertedPass, error: insertError } = await supabase
      .from('season_passes')
      .insert({
        ...receiptMetadata,
        redeemed_code: null,
        season_year: seasonYear,
        source: 'apple_iap',
        user_id: userId,
      })
      .select('id, source')
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    entitlementId = insertedPass.id;
  }

  const { data: cosmetics, error: cosmeticsError } = await supabase
    .from('cosmetic_catalog')
    .select('item_id, category, is_season_pass_exclusive')
    .eq('is_season_pass_exclusive', true);

  if (cosmeticsError) {
    throw new Error(cosmeticsError.message);
  }

  const cosmeticRows: UserCosmeticInsert[] = (cosmetics ?? []).map((item) => ({
    category: item.category,
    item_id: item.item_id,
    metadata: {
      purchase_source: 'apple_iap',
      season_year: seasonYear,
      source: 'season_pass',
    },
    user_id: userId,
  }));

  if (cosmeticRows.length > 0) {
    const { error: cosmeticsGrantError } = await supabase
      .from('user_cosmetics')
      .upsert(cosmeticRows, {
        ignoreDuplicates: true,
        onConflict: 'user_id,item_id',
      });

    if (cosmeticsGrantError) {
      throw new Error(cosmeticsGrantError.message);
    }
  }

  return {
    entitlementId,
    status: existingPass ? 'already_entitled' : 'granted',
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: jsonHeaders,
      status: 204,
    });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed', ok: false }, 405);
  }

  try {
    const token = bearerToken(request);

    if (!token) {
      throw new PublicFunctionError('Authentication required.', 401);
    }

    const body = await readRequestBody(request);
    const expectedBundleId = getOptionalEnv('APPLE_IAP_BUNDLE_ID', fallbackBundleIdentifier);
    const expectedProductId = getOptionalEnv(
      'APPLE_IAP_SEASON_PASS_PRODUCT_ID',
      `${expectedBundleId}.seasonpass.s1`,
    );

    if (body.productId !== expectedProductId) {
      throw new PublicFunctionError('Receipt is not for the Season Pass product.');
    }

    const supabase = createSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new PublicFunctionError('Invalid or expired session.', 401);
    }

    const validation = await verifyReceiptWithApple(
      body.receiptData,
      getRequiredEnv('APPLE_IAP_SHARED_SECRET'),
    );

    if (validation.bundleId !== expectedBundleId) {
      throw new PublicFunctionError('Receipt is not for this app.');
    }

    const purchase = findSeasonPassPurchase(
      validation,
      expectedProductId,
      body.transactionId,
      body.originalTransactionId,
    );

    if (!purchase) {
      throw new PublicFunctionError('Receipt does not include an active Season Pass purchase.');
    }

    const grant = await grantSeasonPassEntitlement({
      environment: validation.environment,
      expectedProductId,
      purchase,
      seasonYear: body.seasonYear,
      supabase,
      userId: user.id,
    });

    return jsonResponse(
      {
        entitlementId: grant.entitlementId,
        ok: true,
        status: grant.status,
      },
      200,
    );
  } catch (error) {
    if (error instanceof PublicFunctionError) {
      return jsonResponse({ error: error.message, ok: false }, error.status);
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Season Pass receipt validation failed', { message });
    return jsonResponse(
      {
        error: 'Season Pass purchase validation is temporarily unavailable.',
        ok: false,
      },
      500,
    );
  }
});
