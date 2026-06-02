import { createClient } from 'jsr:@supabase/supabase-js@2';

import {
  applePurchaseDate,
  isRecord,
  nullableString,
  PublicFunctionError,
  stringField,
  verifyStoreKitPurchase,
} from '../_shared/storekit-2.ts';

type ParsedRequestBody = {
  originalTransactionId: string | null;
  productId: string;
  receiptData: string | null;
  transactionId: string | null;
  transactionJws: string | null;
};

type GrantArenaCoinPurchaseRow = {
  coin_balance: number;
  granted: boolean;
};

type CoinPurchaseDatabase = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: {
      grant_arena_coin_purchase: {
        Args: {
          p_apple_original_transaction_id: string | null;
          p_apple_transaction_id: string;
          p_coin_amount: number;
          p_iap_environment: string | null;
          p_iap_purchase_date: string | null;
          p_product_id: string;
          p_user_id: string;
        };
        Returns: GrantArenaCoinPurchaseRow[];
      };
    };
    Tables: Record<string, never>;
    Views: Record<string, never>;
  };
};

const fallbackBundleIdentifier = 'com.actionarena.app';
const coinAmountByProductId: Record<string, number> = {
  'com.actionarena.app.coins.commissioner': 2800,
  'com.actionarena.app.coins.playmaker': 1200,
  'com.actionarena.app.coins.starter': 500,
};
const jsonHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

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
    throw new PublicFunctionError('Invalid coin purchase request.');
  }

  if (!isRecord(body)) {
    throw new PublicFunctionError('Invalid coin purchase request.');
  }

  const productId = stringField(body, 'productId');
  const receiptData = stringField(body, 'receiptData');
  const transactionJws = nullableString(body.transactionJws);

  if (!productId) {
    throw new PublicFunctionError('Product is required.');
  }

  if (!receiptData && !transactionJws) {
    throw new PublicFunctionError('Receipt or StoreKit transaction is required.');
  }

  return {
    originalTransactionId: nullableString(body.originalTransactionId),
    productId,
    receiptData,
    transactionId: nullableString(body.transactionId),
    transactionJws,
  };
}

function createSupabaseClient() {
  return createClient<CoinPurchaseDatabase>(
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
    const coinAmount = coinAmountByProductId[body.productId];

    if (!coinAmount) {
      throw new PublicFunctionError('Unknown Arena Coin product.');
    }

    const expectedBundleId = getOptionalEnv('APPLE_IAP_BUNDLE_ID', fallbackBundleIdentifier);
    const supabase = createSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new PublicFunctionError('Invalid or expired session.', 401);
    }

    const { environment, purchase } = await verifyStoreKitPurchase({
      expectedBundleId,
      expectedProductId: body.productId,
      originalTransactionId: body.originalTransactionId,
      receiptData: body.receiptData,
      sharedSecret: body.receiptData ? getRequiredEnv('APPLE_IAP_SHARED_SECRET') : null,
      transactionId: body.transactionId,
      transactionJws: body.transactionJws,
    });
    const appleTransactionId = purchase.transactionId ?? body.transactionId;

    if (!appleTransactionId) {
      throw new PublicFunctionError('Apple transaction id is required.');
    }

    const { data, error } = await supabase
      .rpc('grant_arena_coin_purchase', {
        p_apple_original_transaction_id:
          purchase.originalTransactionId ?? body.originalTransactionId,
        p_apple_transaction_id: appleTransactionId,
        p_coin_amount: coinAmount,
        p_iap_environment: environment,
        p_iap_purchase_date: applePurchaseDate(purchase.purchaseDateMs),
        p_product_id: body.productId,
        p_user_id: user.id,
      })
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error('Coin purchase grant returned no balance.');
    }

    return jsonResponse(
      {
        coinBalance: data.coin_balance,
        coinAmount,
        granted: data.granted,
        ok: true,
        status: data.granted ? 'granted' : 'already_granted',
      },
      200,
    );
  } catch (error) {
    if (error instanceof PublicFunctionError) {
      return jsonResponse({ error: error.message, ok: false }, error.status);
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Arena Coin purchase validation failed', { message });
    return jsonResponse(
      {
        error: 'Arena Coin purchase validation is temporarily unavailable.',
        ok: false,
      },
      500,
    );
  }
});
