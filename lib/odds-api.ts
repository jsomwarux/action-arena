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
const ODDS_API_KEY = process.env.EXPO_PUBLIC_ODDS_API_KEY;
export const isUsingMockOdds = process.env.EXPO_PUBLIC_USE_MOCK_DATA === 'true';

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

export async function fetchUpcomingNflOdds(options: FetchUpcomingNflOddsOptions = {}) {
  if (isUsingMockOdds && options.allowMockOdds) {
    return getMockNflOddsApiGames()
      .map(normalizeOddsApiGame)
      .filter((game) => new Date(game.commenceTime).getTime() > Date.now())
      .sort(
        (left, right) =>
          new Date(left.commenceTime).getTime() - new Date(right.commenceTime).getTime(),
      );
  }

  if (!ODDS_API_KEY) {
    throw new Error('Set EXPO_PUBLIC_ODDS_API_KEY to load real NFL lines.');
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
      throw new Error('Unable to load odds. Check the Odds API key, then try again.');
    }

    throw new Error(`Unable to load odds right now. The Odds API returned status ${response.status}.`);
  }

  let data: OddsApiGame[];
  try {
    data = (await response.json()) as OddsApiGame[];
  } catch {
    throw new Error('Unable to load odds right now. The Odds API response could not be read.');
  }

  return data
    .map(normalizeOddsApiGame)
    .filter((game) => new Date(game.commenceTime).getTime() > Date.now())
    .sort(
      (left, right) =>
        new Date(left.commenceTime).getTime() - new Date(right.commenceTime).getTime(),
    );
}
