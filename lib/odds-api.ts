import type { BetMarket } from '@/types/database';

export type OddsApiMarketKey = 'h2h' | 'spreads' | 'totals';
export type OddsRegion = 'us';
export type OddsFormat = 'american';

export type OddsApiOutcome = {
  description?: string;
  name: string;
  point?: number;
  price: number;
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
};

export type OddsGame = {
  awayTeam: string;
  commenceTime: string;
  homeTeam: string;
  id: string;
  markets: Record<BetMarket, OddsSelection[]>;
};

const ODDS_API_BASE_URL = 'https://api.the-odds-api.com/v4';
const NFL_SPORT_KEY = 'americanfootball_nfl';
const ODDS_API_KEY = process.env.EXPO_PUBLIC_ODDS_API_KEY;

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

  return {
    description: outcome.description,
    label,
    line,
    market,
    odds: outcome.price,
    selection: isTotal ? outcome.name : outcome.name,
  };
}

function normalizeGame(game: OddsApiGame): OddsGame {
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

export async function fetchUpcomingNflOdds() {
  if (!ODDS_API_KEY) {
    throw new Error('Set EXPO_PUBLIC_ODDS_API_KEY to load real NFL lines.');
  }

  const url = new URL(`${ODDS_API_BASE_URL}/sports/${NFL_SPORT_KEY}/odds`);
  url.searchParams.set('apiKey', ODDS_API_KEY);
  url.searchParams.set('regions', 'us');
  url.searchParams.set('markets', 'h2h,spreads,totals');
  url.searchParams.set('oddsFormat', 'american');
  url.searchParams.set('dateFormat', 'iso');

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Lines request failed with status ${response.status}.`);
  }

  const data = (await response.json()) as OddsApiGame[];
  return data
    .map(normalizeGame)
    .filter((game) => new Date(game.commenceTime).getTime() > Date.now())
    .sort(
      (left, right) =>
        new Date(left.commenceTime).getTime() - new Date(right.commenceTime).getTime(),
    );
}
