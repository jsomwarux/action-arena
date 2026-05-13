import { createClient } from 'jsr:@supabase/supabase-js@2';

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type LiveScoreCandidate = {
  away_team: string | null;
  commence_time: string;
  game_id: string;
  home_team: string | null;
  status: string;
};

type LiveScoreDatabase = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: {
      live_score_polling_candidates: {
        Args: Record<string, never>;
        Returns: LiveScoreCandidate[];
      };
      upsert_live_game_states: {
        Args: {
          p_scores: Json;
        };
        Returns: number;
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
  current_period?: string;
  status?: string;
  time_remaining?: string;
};

type RequestBody = {
  force?: unknown;
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

function parseSportKey(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : NFL_SPORT_KEY;
}

function parseBoolean(value: unknown) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return false;
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

function stringField(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === 'string' ? value : '';
}

function optionalStringField(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === 'string' ? value : undefined;
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
      away_team: stringField(row, 'away_team'),
      commence_time: stringField(row, 'commence_time'),
      completed: row.completed === true,
      current_period: optionalStringField(row, 'current_period') ?? optionalStringField(row, 'period'),
      home_team: stringField(row, 'home_team'),
      id: stringField(row, 'id'),
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
      sport_key: stringField(row, 'sport_key'),
      sport_title: stringField(row, 'sport_title'),
      status: optionalStringField(row, 'status'),
      time_remaining: optionalStringField(row, 'time_remaining') ?? optionalStringField(row, 'clock'),
    };
  });
}

async function fetchScores({
  oddsApiKey,
  sportKey,
}: {
  oddsApiKey: string;
  sportKey: string;
}) {
  const url = new URL(`${ODDS_API_BASE_URL}/sports/${sportKey}/scores`);
  url.searchParams.set('apiKey', oddsApiKey);
  url.searchParams.set('daysFrom', '1');
  url.searchParams.set('dateFormat', 'iso');

  const response = await fetch(url.toString());

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Odds API live scores request failed with ${response.status}: ${body}`);
  }

  return assertScoresPayload(await response.json());
}

function isUsefulScore(game: OddsApiScoreGame, candidateIds: Set<string>, force: boolean) {
  if (!game.id || (!force && !candidateIds.has(game.id))) {
    return false;
  }

  return game.completed || Array.isArray(game.scores);
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

    const cronSecret = Deno.env.get('LIVE_SCORES_CRON_SECRET');
    const suppliedSecret = request.headers.get('x-live-scores-secret');

    if (cronSecret && suppliedSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: jsonHeaders,
        status: 401,
      });
    }

    const rawBody = await readBody(request);
    const body = toRequestBody(rawBody);
    const searchParams = new URL(request.url).searchParams;
    const sportKey = parseSportKey(searchParams.get('sportKey') ?? body.sportKey);
    const force = parseBoolean(searchParams.get('force') ?? body.force);
    const suppliedScoresPayload = Array.isArray(rawBody) ? rawBody : body.scores;

    const supabase = createClient<LiveScoreDatabase>(
      getRequiredEnv('SUPABASE_URL'),
      getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
      {
        auth: {
          persistSession: false,
        },
      },
    );

    const { data: candidates, error: candidatesError } = await supabase.rpc('live_score_polling_candidates');

    if (candidatesError) {
      throw new Error(candidatesError.message);
    }

    const candidateIds = new Set((candidates ?? []).map((candidate) => candidate.game_id));

    if (!force && candidateIds.size === 0 && !Array.isArray(suppliedScoresPayload)) {
      console.info('Skipping live score sync; no in-progress or near-kickoff games need polling.');
      return new Response(
        JSON.stringify({
          candidates: 0,
          durationMs: Date.now() - startedAt,
          ok: true,
          scoresFetched: 0,
          scoresWritten: 0,
          skipped: true,
          sportKey,
        }),
        { headers: jsonHeaders, status: 200 },
      );
    }

    const scores = Array.isArray(suppliedScoresPayload)
      ? assertScoresPayload(suppliedScoresPayload)
      : await fetchScores({
          oddsApiKey: getOddsApiKey(),
          sportKey,
        });
    const filteredScores = scores.filter((game) => isUsefulScore(game, candidateIds, force));

    const { data: scoresWritten, error: upsertError } = await supabase.rpc('upsert_live_game_states', {
      p_scores: filteredScores as unknown as Json,
    });

    if (upsertError) {
      throw new Error(upsertError.message);
    }

    const durationMs = Date.now() - startedAt;
    console.info('Completed live score sync', {
      candidates: candidateIds.size,
      durationMs,
      scoresFetched: scores.length,
      scoresWritten,
      sportKey,
    });

    return new Response(
      JSON.stringify({
        candidates: candidateIds.size,
        durationMs,
        ok: true,
        scoresFetched: scores.length,
        scoresWritten,
        sportKey,
      }),
      { headers: jsonHeaders, status: 200 },
    );
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = errorMessage(error);
    console.error('Live score sync failed', { durationMs, message });

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
