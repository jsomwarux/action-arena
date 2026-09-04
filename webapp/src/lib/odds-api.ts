import { ODDS_API_KEY, USE_MOCK_DATA } from '@/lib/env';
import type { BetMarket } from '@/types/database';

import { getNflTeamShortName } from './nfl-teams';
import { getMockNflOddsApiGames } from './mock-nfl-odds';

export type OddsApiMarketKey = 'h2h' | 'spreads' | 'totals';
export type OddsRegion = 'us';
export type OddsFormat = 'american';

export type OddsApiOutcome = {
  description?: string;
  name: string;
  point?: number;
  price: number;
  short_name?: string;
};

export type OddsApiMarket = {
  key: OddsApiMarketKey;
  last_update: string;
  outcomes: OddsApiOutcome[];
};

export type OddsApiBookmaker = {
  key: string;
  last_update: string;
  markets: OddsApiMarket[];
  title: string;
};

export type OddsApiGame = {
  away_team: string;
  bookmakers: OddsApiBookmaker[];
  commence_time: string;
  home_team: string;
  id: string;
  sport_key: 'americanfootball_nfl';
  sport_title: string;
};

export type OddsSelection = {
  description?: string;
  label: string;
  line: number | null;
  market: BetMarket;
  odds: number;
  selection: string;
  shortName: string;
};

export type OddsGame = {
  awayTeam: string;
  commenceTime: string;
  homeTeam: string;
  id: string;
  markets: Record<BetMarket, OddsSelection[]>;
};

export type FetchUpcomingNflOddsOptions = {
  allowMockOdds?: boolean;
};

const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4';
const NFL_SPORT_KEY = 'americanfootball_nfl';
export const isUsingMockOdds = USE_MOCK_DATA;

const marketKeyToBetMarket: Record<OddsApiMarketKey, BetMarket> = {
  h2h: 'moneyline',
  spreads: 'spread',
  totals: 'over_under',
};

function emptyMarkets(): Record<BetMarket, OddsSelection[]> {
  return {
    moneyline: [],
    over_under: [],
    spread: [],
  };
}

function selectBookmaker(bookmakers: OddsApiBookmaker[]) {
  return bookmakers[0] ?? null;
}

function normalizeOutcome(outcome: OddsApiOutcome, market: BetMarket): OddsSelection {
  const isTotal = market === 'over_under';
  const line = typeof outcome.point === 'number' ? outcome.point : null;
  const label = isTotal && line !== null ? `${outcome.name} ${line}` : outcome.name;
  const shortName = isTotal ? outcome.name : (outcome.short_name ?? getNflTeamShortName(outcome.name));

  return {
    description: outcome.description,
    label,
    line,
    market,
    odds: outcome.price,
    selection: isTotal ? outcome.name : outcome.name,
    shortName,
  };
}

export function normalizeOddsApiGame(game: OddsApiGame): OddsGame {
  const markets = emptyMarkets();
  const bookmaker = selectBookmaker(game.bookmakers);

  bookmaker?.markets.forEach((market) => {
    const betMarket = marketKeyToBetMarket[market.key];
    markets[betMarket] = market.outcomes.map((outcome) => normalizeOutcome(outcome, betMarket));
  });

  return {
    awayTeam: game.away_team,
    commenceTime: game.commence_time,
    homeTeam: game.home_team,
    id: game.id,
    markets,
  };
}

const NFL_WEEK_ZONE = 'America/New_York';
/** Tuesday, on `Date`'s 0-is-Sunday numbering. */
const NFL_WEEK_START_WEEKDAY = 2;
const NFL_WEEK_START_HOUR = 6;

/** How far a UTC instant must shift to be read as `NFL_WEEK_ZONE` wall-clock. */
function zoneOffsetMs(instant: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: '2-digit',
    second: '2-digit',
    timeZone: NFL_WEEK_ZONE,
    year: 'numeric',
  }).formatToParts(new Date(instant));

  const field: Record<string, number> = {};
  parts.forEach((part) => {
    if (part.type !== 'literal') {
      field[part.type] = Number(part.value);
    }
  });

  // `hour12: false` reports midnight as 24 in some engines.
  const asIfUtc = Date.UTC(
    field.year,
    field.month - 1,
    field.day,
    field.hour % 24,
    field.minute,
    field.second,
  );

  return asIfUtc - instant;
}

/** The UTC instant of an Eastern wall-clock time. Day may be out of range. */
function instantFromEastern(year: number, month: number, day: number, hour: number): number {
  const naive = Date.UTC(year, month - 1, day, hour);
  // Two passes: un-shifting needs the offset in force at the *result*, which
  // the first pass only approximates when the week opens across a DST edge.
  return naive - zoneOffsetMs(naive - zoneOffsetMs(naive));
}

/** Opening boundary — Tuesday 06:00 ET — of the NFL week holding `instant`. */
function nflWeekStart(instant: number): number {
  const wall = new Date(instant + zoneOffsetMs(instant));
  const year = wall.getUTCFullYear();
  const month = wall.getUTCMonth() + 1;
  const daysSinceTuesday = (wall.getUTCDay() - NFL_WEEK_START_WEEKDAY + 7) % 7;

  const start = instantFromEastern(
    year,
    month,
    wall.getUTCDate() - daysSinceTuesday,
    NFL_WEEK_START_HOUR,
  );

  if (start <= instant) {
    return start;
  }

  // Tuesday before 06:00 ET still belongs to the week that opened a week ago.
  return instantFromEastern(
    year,
    month,
    wall.getUTCDate() - daysSinceTuesday - 7,
    NFL_WEEK_START_HOUR,
  );
}

/** Closing boundary of the week that opened at `start`. */
function nflWeekEnd(start: number): number {
  const wall = new Date(start + zoneOffsetMs(start));

  // Advanced in wall-clock days, not 168 hours, so a DST changeover inside the
  // week neither stretches nor clips it.
  return instantFromEastern(
    wall.getUTCFullYear(),
    wall.getUTCMonth() + 1,
    wall.getUTCDate() + 7,
    NFL_WEEK_START_HOUR,
  );
}

/**
 * The board is a one-week slate, but /odds returns every scheduled game the
 * book has priced. In season that is the whole rest of the year, which is how
 * a Week 17 game ended up on the board next to a Week 2 budget. The mock
 * fixture holds a single week, so nothing local ever showed it.
 *
 * The window is an NFL week: Tuesday 06:00 ET through the following Tuesday
 * 06:00 ET. Every fixture — a Thursday opener, a Saturday double-header, a
 * Sunday morning kickoff in London, a Monday nightcap — falls inside one of
 * those, and a bye simply means a team has no game in it. Because the boundary
 * is the calendar week and not a kickoff, the slate does not move when
 * Thursday's game starts and drops out of `upcoming`.
 *
 * The week is chosen from the earliest kickoff still ahead of us rather than
 * from the clock, which matters only in the gaps: between the last game of a
 * week and the Tuesday boundary, and in the run-up to Week 1, the current
 * calendar week holds no games at all and anchoring on the clock would empty
 * the board. Snapping the first upcoming kickoff back to its own Tuesday gives
 * the same answer every other moment of the season.
 */
function scopeToSlateWindow(games: OddsGame[]): OddsGame[] {
  const now = Date.now();
  const upcoming = games
    .map((game) => ({ game, kickoff: new Date(game.commenceTime).getTime() }))
    .filter((entry) => Number.isFinite(entry.kickoff) && entry.kickoff > now)
    .sort((left, right) => left.kickoff - right.kickoff);

  const first = upcoming[0];

  if (!first) {
    return [];
  }

  const windowEnd = nflWeekEnd(nflWeekStart(first.kickoff));

  return upcoming.filter((entry) => entry.kickoff < windowEnd).map((entry) => entry.game);
}

export async function fetchUpcomingNflOdds(options: FetchUpcomingNflOddsOptions = {}) {
  if (isUsingMockOdds && options.allowMockOdds) {
    return scopeToSlateWindow(getMockNflOddsApiGames().map(normalizeOddsApiGame));
  }

  if (!ODDS_API_KEY) {
    throw new Error('NFL lines are unavailable right now. Please try again later.');
  }

  const url = new URL(`${ODDS_API_BASE_URL}/sports/${NFL_SPORT_KEY}/odds`);
  url.searchParams.set('apiKey', ODDS_API_KEY);
  url.searchParams.set('regions', 'us');
  url.searchParams.set('markets', 'h2h,spreads,totals');
  url.searchParams.set('oddsFormat', 'american');
  url.searchParams.set('dateFormat', 'iso');

  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetch(url.toString());
  } catch {
    throw new Error('Unable to load odds right now. Check your connection, then try again.');
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('Unable to load odds right now. Please try again later.');
    }

    throw new Error(`Unable to load odds right now. The Odds API returned status ${response.status}.`);
  }

  let data: OddsApiGame[];
  try {
    data = (await response.json()) as OddsApiGame[];
  } catch {
    throw new Error('Unable to load odds right now. The Odds API response could not be read.');
  }

  return scopeToSlateWindow(data.map(normalizeOddsApiGame));
}
