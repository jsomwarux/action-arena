import { createClient } from 'jsr:@supabase/supabase-js@2';

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type SettlementSummary = {
  completed_games: number;
  resolved_weeks: number;
  settled_bets: number;
  updated_legs: number;
};

type SettlementDatabase = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: {
      settle_completed_scores: {
        Args: {
          p_scores: Json;
        };
        Returns: SettlementSummary;
      };
    };
    Tables: Record<string, never>;
    Views: Record<string, never>;
  };
};

type OddsApiScoreRow = {
  name: string;
  score: string;
};

type OddsApiScoreGame = {
  away_team: string;
  commence_time: string;
  completed: boolean;
  home_team: string;
  id: string;
  last_update: string | null;
  scores: OddsApiScoreRow[] | null;
  sport_key: string;
  sport_title: string;
};

type RequestBody = {
  daysFrom?: unknown;
  scores?: unknown;
  sportKey?: unknown;
};

const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4';
const NFL_SPORT_KEY = 'americanfootball_nfl';

const jsonHeaders = {
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

function parseDaysFrom(value: unknown) {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return Math.min(Math.max(value, 1), 3);
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);

    if (Number.isInteger(parsed)) {
      return Math.min(Math.max(parsed, 1), 3);
    }
  }

  return 3;
}

function parseSportKey(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : NFL_SPORT_KEY;
}

async function readBody(request: Request): Promise<unknown> {
  if (request.method === 'GET') {
    return {};
  }

  const text = await request.text();

  if (!text.trim()) {
    return {};
  }

  return JSON.parse(text) as unknown;
}

function toRequestBody(value: unknown): RequestBody {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {};
  }

  return value as RequestBody;
}

function assertScoresPayload(payload: unknown): OddsApiScoreGame[] {
  if (!Array.isArray(payload)) {
    throw new Error('Odds API scores response was not an array.');
  }

  return payload.map((game): OddsApiScoreGame => {
    if (typeof game !== 'object' || game === null) {
      throw new Error('Odds API scores response included an invalid game row.');
    }

    const row = game as Record<string, unknown>;
    const scores = row.scores;

    return {
      away_team: String(row.away_team ?? ''),
      commence_time: String(row.commence_time ?? ''),
      completed: row.completed === true,
      home_team: String(row.home_team ?? ''),
      id: String(row.id ?? ''),
      last_update: typeof row.last_update === 'string' ? row.last_update : null,
      scores: Array.isArray(scores)
        ? scores.map((score): OddsApiScoreRow => {
            const scoreRow = score as Record<string, unknown>;
            return {
              name: String(scoreRow.name ?? ''),
              score: String(scoreRow.score ?? ''),
            };
          })
        : null,
      sport_key: String(row.sport_key ?? ''),
      sport_title: String(row.sport_title ?? ''),
    };
  });
}

async function fetchCompletedScores({
  daysFrom,
  oddsApiKey,
  sportKey,
}: {
  daysFrom: number;
  oddsApiKey: string;
  sportKey: string;
}) {
  const url = new URL(`${ODDS_API_BASE_URL}/sports/${sportKey}/scores`);
  url.searchParams.set('apiKey', oddsApiKey);
  url.searchParams.set('daysFrom', String(daysFrom));
  url.searchParams.set('dateFormat', 'iso');

  const response = await fetch(url.toString());

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Odds API scores request failed with ${response.status}: ${body}`);
  }

  const payload = await response.json();
  return assertScoresPayload(payload).filter((game) => game.completed && game.scores);
}

Deno.serve(async (request) => {
  const startedAt = Date.now();

  try {
    if (!['GET', 'POST'].includes(request.method)) {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        headers: jsonHeaders,
        status: 405,
      });
    }

    const cronSecret = Deno.env.get('SETTLEMENT_CRON_SECRET');
    const suppliedSecret = request.headers.get('x-settlement-secret');

    if (cronSecret && suppliedSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: jsonHeaders,
        status: 401,
      });
    }

    const rawBody = await readBody(request);
    const body = toRequestBody(rawBody);
    const searchParams = new URL(request.url).searchParams;
    const daysFrom = parseDaysFrom(searchParams.get('daysFrom') ?? body.daysFrom);
    const sportKey = parseSportKey(searchParams.get('sportKey') ?? body.sportKey);
    const suppliedScoresPayload = Array.isArray(rawBody) ? rawBody : body.scores;

    console.info('Starting pick settlement run', { daysFrom, sportKey });

    const scores = Array.isArray(suppliedScoresPayload)
      ? assertScoresPayload(suppliedScoresPayload).filter((game) => game.completed && game.scores)
      : await fetchCompletedScores({
          daysFrom,
          oddsApiKey: getOddsApiKey(),
          sportKey,
        });

    console.info('Fetched completed score rows', { count: scores.length, sportKey });

    const supabase = createClient<SettlementDatabase>(
      getRequiredEnv('SUPABASE_URL'),
      getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: {
          persistSession: false,
        },
      },
    );

    const { data, error } = await supabase.rpc('settle_completed_scores', {
      p_scores: scores as unknown as Json,
    });

    if (error) {
      throw new Error(error.message);
    }

    const durationMs = Date.now() - startedAt;
    console.info('Completed pick settlement run', { durationMs, settlement: data });
    console.info('[analytics]', 'pick_settled', {
      durationMs,
      result: 'summary',
      settled_picks: data?.settled_bets ?? 0,
      sportKey,
    });

    return new Response(
      JSON.stringify({
        durationMs,
        ok: true,
        scoresFetched: scores.length,
        settlement: data,
        sportKey,
      }),
      {
        headers: jsonHeaders,
        status: 200,
      },
    );
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = errorMessage(error);
    console.error('Pick settlement run failed', { durationMs, message });

    return new Response(
      JSON.stringify({
        durationMs,
        error: message,
        ok: false,
      }),
      {
        headers: jsonHeaders,
        status: 500,
      },
    );
  }
});
