import { createClient } from 'jsr:@supabase/supabase-js@2';

type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type NotificationType =
  | 'odds_available'
  | 'bet_reminders'
  | 'bet_results'
  | 'parlay_leg_updates'
  | 'parlay_hits'
  | 'matchup_results'
  | 'weekly_awards'
  | 'opponent_bets_locked';

type NotificationEvent = {
  bet_id: string | null;
  body: string;
  data: Json;
  id: string;
  league_id: string | null;
  matchup_id: string | null;
  notification_type: NotificationType;
  recipient_user_id: string;
  title: string;
};

type UserRow = {
  id: string;
  push_token: string | null;
};

type NotificationPreferencesRow = {
  bet_reminders: boolean;
  bet_results: boolean;
  matchup_results: boolean;
  odds_available: boolean;
  opponent_bets_locked: boolean;
  parlay_hits: boolean;
  parlay_leg_updates: boolean;
  user_id: string;
  weekly_awards: boolean;
};

type LeagueRow = {
  current_week: number;
  id: string;
  name: string;
  status: 'drafting' | 'active' | 'playoffs' | 'complete';
};

type LeagueMemberRow = {
  league_id: string;
  user_id: string;
};

type BetRow = {
  id: string;
  league_id: string;
  user_id: string;
  week_number: number;
};

type NotificationDatabase = {
  public: {
    CompositeTypes: Record<string, never>;
    Enums: Record<string, never>;
    Functions: Record<string, never>;
    Tables: {
      bets: {
        Insert: never;
        Relationships: [];
        Row: BetRow;
        Update: never;
      };
      league_members: {
        Insert: never;
        Relationships: [];
        Row: LeagueMemberRow;
        Update: never;
      };
      leagues: {
        Insert: never;
        Relationships: [];
        Row: LeagueRow;
        Update: never;
      };
      notification_events: {
        Insert: {
          body: string;
          data?: Json;
          idempotency_key?: string | null;
          league_id?: string | null;
          notification_type: NotificationType;
          recipient_user_id: string;
          status?: 'pending' | 'sent' | 'skipped' | 'failed';
          title: string;
        };
        Relationships: [];
        Row: NotificationEvent;
        Update: {
          error?: string | null;
          sent_at?: string | null;
          status?: 'pending' | 'sent' | 'skipped' | 'failed';
        };
      };
      notification_preferences: {
        Insert: never;
        Relationships: [];
        Row: NotificationPreferencesRow;
        Update: never;
      };
      users: {
        Insert: never;
        Relationships: [];
        Row: UserRow;
        Update: never;
      };
    };
    Views: Record<string, never>;
  };
};

type RequestBody = {
  firstGameStartsAt?: unknown;
  limit?: unknown;
  mode?: unknown;
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const MINIMUM_BETS = 5;

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

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown error';
}

function parseLimit(value: unknown) {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isInteger(parsed)
    ? Math.min(Math.max(parsed, 1), 100)
    : 50;
}

function isRecord(value: Json): value is Record<string, Json> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function uniqueValues(values: string[]) {
  return [...new Set(values)];
}

function formatCoinsInCopy(value: string) {
  return value.replace(/([+-]?)\$(\d+(?:\.\d+)?)/g, (_match, sign: string, amount: string) => {
    const rounded = Math.round(Number(amount));
    return `${sign}${rounded} coins`;
  });
}

function sanitizeNotificationCopy(value: string) {
  let next = formatCoinsInCopy(value);

  next = next.replace(
    /^Your bet on (.+?) hit!? ?([+-]?\d+ coins)?$/i,
    (_match, selection: string, reward?: string) =>
      `Your ${selection} pick hit.${reward ? ` ${reward}` : ''}`,
  );
  next = next.replace(
    /^Your (.+?-leg parlay) just hit!? ?([+-]?\d+ coins)?$/i,
    (_match, label: string, reward?: string) => `Your ${label} hit.${reward ? ` ${reward}` : ''}`,
  );
  next = next.replace(
    /^You beat (.+?) (\d+) coins to (\d+) coins$/i,
    (_match, opponent: string, left: string, right: string) => `You beat ${opponent} ${left} to ${right}`,
  );

  return next
    .replace(/\bBets\b/g, 'Picks')
    .replace(/\bbets\b/g, 'picks')
    .replace(/\bBet\b/g, 'Pick')
    .replace(/\bbet\b/g, 'pick')
    .replace(/\bWagers\b/g, 'Picks')
    .replace(/\bwagers\b/g, 'picks')
    .replace(/\bWager\b/g, 'Pick')
    .replace(/\bwager\b/g, 'pick')
    .replace(/\blocked in their Week (\d+) picks\b/g, 'submitted their Week $1 picks')
    .replace(/\blocked in their picks\b/g, 'submitted their picks')
    .replace(/\bOpponent locked in\b/g, 'Opponent submitted picks');
}

function createSupabaseClient() {
  return createClient<NotificationDatabase>(
    getRequiredEnv('SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        persistSession: false,
      },
    },
  );
}

async function readBody(request: Request) {
  if (request.method === 'GET') {
    return {};
  }

  const text = await request.text();
  return text.trim() ? (JSON.parse(text) as RequestBody) : {};
}

async function markEvent(
  supabase: ReturnType<typeof createSupabaseClient>,
  eventId: string,
  status: 'sent' | 'skipped' | 'failed',
  error: string | null = null,
) {
  await supabase
    .from('notification_events')
    .update({
      error,
      sent_at: status === 'sent' || status === 'skipped' ? new Date().toISOString() : null,
      status,
    })
    .eq('id', eventId);
}

async function sendExpoPush({
  body,
  data,
  title,
  token,
}: {
  body: string;
  data: Json;
  title: string;
  token: string;
}) {
  const response = await fetch(EXPO_PUSH_URL, {
    body: JSON.stringify({
      body,
      data: isRecord(data) ? data : {},
      sound: 'default',
      title,
      to: token,
    }),
    headers: jsonHeaders,
    method: 'POST',
  });

  const payload = await response.json() as { data?: { message?: string; status?: string } };

  if (!response.ok || payload.data?.status === 'error') {
    throw new Error(payload.data?.message ?? `Expo push failed with ${response.status}`);
  }
}

async function processQueuedNotifications(
  supabase: ReturnType<typeof createSupabaseClient>,
  limit: number,
) {
  const { data: events, error: eventsError } = await supabase
    .from('notification_events')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (eventsError) {
    throw new Error(eventsError.message);
  }

  const queue = events ?? [];
  const userIds = uniqueValues(queue.map((event) => event.recipient_user_id));

  if (userIds.length === 0) {
    return { failed: 0, processed: 0, sent: 0, skipped: 0 };
  }

  const [usersResult, preferencesResult] = await Promise.all([
    supabase.from('users').select('id, push_token').in('id', userIds),
    supabase.from('notification_preferences').select('*').in('user_id', userIds),
  ]);

  if (usersResult.error) {
    throw new Error(usersResult.error.message);
  }

  if (preferencesResult.error) {
    throw new Error(preferencesResult.error.message);
  }

  const usersById = new Map((usersResult.data ?? []).map((user) => [user.id, user]));
  const preferencesByUserId = new Map(
    (preferencesResult.data ?? []).map((preferences) => [preferences.user_id, preferences]),
  );

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const event of queue) {
    const user = usersById.get(event.recipient_user_id);
    const preferences = preferencesByUserId.get(event.recipient_user_id);
    const preferenceEnabled = preferences ? preferences[event.notification_type] : true;

    if (!preferenceEnabled) {
      skipped += 1;
      await markEvent(supabase, event.id, 'skipped', 'Notification type disabled by user.');
      continue;
    }

    if (!user?.push_token) {
      skipped += 1;
      await markEvent(supabase, event.id, 'skipped', 'User has no Expo push token.');
      continue;
    }

    try {
      const title = sanitizeNotificationCopy(event.title);
      const body = sanitizeNotificationCopy(event.body);
      await sendExpoPush({
        body,
        data: event.data,
        title,
        token: user.push_token,
      });
      sent += 1;
      await markEvent(supabase, event.id, 'sent');
    } catch (error) {
      failed += 1;
      await markEvent(supabase, event.id, 'failed', errorMessage(error));
    }
  }

  return { failed, processed: queue.length, sent, skipped };
}

async function enqueueOddsAvailable(supabase: ReturnType<typeof createSupabaseClient>) {
  const { data: leagues, error: leaguesError } = await supabase
    .from('leagues')
    .select('*')
    .in('status', ['drafting', 'active']);

  if (leaguesError) {
    throw new Error(leaguesError.message);
  }

  const activeLeagues = leagues ?? [];
  const leagueIds = activeLeagues.map((league) => league.id);

  if (leagueIds.length === 0) {
    return 0;
  }

  const { data: members, error: membersError } = await supabase
    .from('league_members')
    .select('*')
    .in('league_id', leagueIds);

  if (membersError) {
    throw new Error(membersError.message);
  }

  const leagueById = new Map(activeLeagues.map((league) => [league.id, league]));
  const rows = (members ?? []).map((member) => {
    const league = leagueById.get(member.league_id);
    return {
      body: `${league?.name ?? 'Your league'} Week ${league?.current_week ?? ''} lines are live. Time to build your lineup.`,
      data: {
        leagueId: member.league_id,
        type: 'bet_board',
      },
      idempotency_key: `odds_available:${member.league_id}:${league?.current_week ?? 0}:${member.user_id}`,
      league_id: member.league_id,
      notification_type: 'odds_available' as NotificationType,
      recipient_user_id: member.user_id,
      title: "New week's lines are live",
    };
  });

  const { error } = await supabase
    .from('notification_events')
    .upsert(rows, { ignoreDuplicates: true, onConflict: 'idempotency_key' });

  if (error) {
    throw new Error(error.message);
  }

  return rows.length;
}

async function enqueueBetReminders(
  supabase: ReturnType<typeof createSupabaseClient>,
  firstGameStartsAt: string | null,
) {
  const { data: leagues, error: leaguesError } = await supabase
    .from('leagues')
    .select('*')
    .in('status', ['drafting', 'active']);

  if (leaguesError) {
    throw new Error(leaguesError.message);
  }

  const activeLeagues = leagues ?? [];
  const leagueIds = activeLeagues.map((league) => league.id);

  if (leagueIds.length === 0) {
    return 0;
  }

  const { data: members, error: membersError } = await supabase
    .from('league_members')
    .select('*')
    .in('league_id', leagueIds);

  if (membersError) {
    throw new Error(membersError.message);
  }

  const leagueById = new Map(activeLeagues.map((league) => [league.id, league]));
  const rows = [];

  for (const member of members ?? []) {
    const league = leagueById.get(member.league_id);

    if (!league) {
      continue;
    }

    const { count, error } = await supabase
      .from('bets')
      .select('id', { count: 'exact', head: true })
      .eq('league_id', member.league_id)
      .eq('user_id', member.user_id)
      .eq('week_number', league.current_week);

    if (error) {
      throw new Error(error.message);
    }

    const placed = count ?? 0;

    if (placed >= MINIMUM_BETS) {
      continue;
    }

    rows.push({
      body: `${league.name}: ${MINIMUM_BETS - placed} picks still needed before kickoff.`,
      data: {
        firstGameStartsAt,
        leagueId: member.league_id,
        type: 'bet_board',
      },
      idempotency_key: `bet_reminder:${member.league_id}:${league.current_week}:${member.user_id}`,
      league_id: member.league_id,
      notification_type: 'bet_reminders' as NotificationType,
      recipient_user_id: member.user_id,
      title: 'Picks still needed',
    });
  }

  if (rows.length === 0) {
    return 0;
  }

  const { error } = await supabase
    .from('notification_events')
    .upsert(rows, { ignoreDuplicates: true, onConflict: 'idempotency_key' });

  if (error) {
    throw new Error(error.message);
  }

  return rows.length;
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

    const suppliedSecret = request.headers.get('x-notification-secret');
    const notificationSecret = Deno.env.get('NOTIFICATION_CRON_SECRET');

    if (notificationSecret && suppliedSecret !== notificationSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: jsonHeaders,
        status: 401,
      });
    }

    const body = await readBody(request);
    const mode = typeof body.mode === 'string' ? body.mode : 'process';
    const limit = parseLimit(body.limit);
    const supabase = createSupabaseClient();
    let result: unknown;

    if (mode === 'odds_available') {
      result = { enqueued: await enqueueOddsAvailable(supabase) };
    } else if (mode === 'bet_reminders') {
      result = {
        enqueued: await enqueueBetReminders(
          supabase,
          typeof body.firstGameStartsAt === 'string' ? body.firstGameStartsAt : null,
        ),
      };
    } else {
      result = await processQueuedNotifications(supabase, limit);
    }

    return new Response(
      JSON.stringify({
        durationMs: Date.now() - startedAt,
        ok: true,
        result,
      }),
      {
        headers: jsonHeaders,
        status: 200,
      },
    );
  } catch (error) {
    console.error('Notification processing failed', { message: errorMessage(error) });

    return new Response(
      JSON.stringify({
        durationMs: Date.now() - startedAt,
        error: errorMessage(error),
        ok: false,
      }),
      {
        headers: jsonHeaders,
        status: 500,
      },
    );
  }
});
