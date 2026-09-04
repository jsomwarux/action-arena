// Deploy with: npx supabase functions deploy fetch-odds
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Server-side proxy for The Odds API upcoming-odds endpoint.
 *
 * The mobile app calls The Odds API directly with a public env key, which is
 * fine inside an app binary. A browser bundle is not: anything Vite inlines is
 * readable in devtools. The web client calls this function instead, so the key
 * never leaves the Edge Function.
 *
 * The response body is The Odds API payload unchanged — this function proxies
 * and authorizes, it does not reshape. Normalization stays in the client.
 */

type FetchOddsDatabase = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: Record<string, never>;
    Tables: Record<string, never>;
    Views: Record<string, never>;
  };
};

type RequestBody = {
  dateFormat?: unknown;
  markets?: unknown;
  oddsFormat?: unknown;
  regions?: unknown;
  sportKey?: unknown;
};

const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4';
const NFL_SPORT_KEY = 'americanfootball_nfl';
const DEFAULT_REGIONS = 'us';
const DEFAULT_MARKETS = 'h2h,spreads,totals';
const DEFAULT_ODDS_FORMAT = 'american';
const DEFAULT_DATE_FORMAT = 'iso';

const jsonHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

function getRequiredEnv(name: string) {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getOddsApiKey() {
  const key = Deno.env.get('ODDS_API_KEY') ?? Deno.env.get('EXPO_PUBLIC_ODDS_API_KEY');

  if (!key) {
    throw new Error('Missing Odds API key. Set ODDS_API_KEY for the Edge Function.');
  }

  return key;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
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

function stringParam(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

async function readBody(request: Request): Promise<RequestBody> {
  const text = await request.text();

  if (!text.trim()) {
    return {};
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(text) as unknown;
  } catch (_error) {
    return {};
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {};
  }

  return parsed as RequestBody;
}

/**
 * Verifies the caller's Supabase session.
 *
 * Unlike the other JWT-guarded functions this one never reads or writes the
 * database, so it authenticates with the anon key rather than the service role
 * key — `auth.getUser` needs no elevated privilege.
 */
async function getAuthenticatedUserId(token: string) {
  const supabase = createClient<FetchOddsDatabase>(
    getRequiredEnv('SUPABASE_URL'),
    getRequiredEnv('SUPABASE_ANON_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return null;
  }

  return user.id;
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
      return jsonResponse({ error: 'Authentication required', ok: false }, 401);
    }

    const userId = await getAuthenticatedUserId(token);

    if (!userId) {
      return jsonResponse({ error: 'Invalid or expired session', ok: false }, 401);
    }

    const body = await readBody(request);
    const sportKey = stringParam(body.sportKey, NFL_SPORT_KEY);

    const url = new URL(`${ODDS_API_BASE_URL}/sports/${sportKey}/odds`);
    url.searchParams.set('apiKey', getOddsApiKey());
    url.searchParams.set('regions', stringParam(body.regions, DEFAULT_REGIONS));
    url.searchParams.set('markets', stringParam(body.markets, DEFAULT_MARKETS));
    url.searchParams.set('oddsFormat', stringParam(body.oddsFormat, DEFAULT_ODDS_FORMAT));
    url.searchParams.set('dateFormat', stringParam(body.dateFormat, DEFAULT_DATE_FORMAT));

    const response = await fetch(url.toString());

    if (!response.ok) {
      const detail = await response.text();
      // The upstream body can echo the API key back in its error text, so it
      // is logged rather than returned.
      console.error('Odds API upcoming odds request failed', {
        detail,
        sportKey,
        status: response.status,
      });

      return jsonResponse(
        {
          error: `Unable to load odds right now. The Odds API returned status ${response.status}.`,
          ok: false,
        },
        502,
      );
    }

    const payload = await response.json();

    return new Response(JSON.stringify(payload), {
      headers: jsonHeaders,
      status: 200,
    });
  } catch (error) {
    const message = errorMessage(error);
    console.error('Odds proxy failed', { message });

    return jsonResponse({ error: 'Unable to load odds right now.', ok: false }, 500);
  }
});
