import { getNflTeamShortName } from '@/lib/nfl-teams';
import type { OddsApiGame, OddsApiMarket } from '@/lib/odds-api';

type MockGameSlot =
  | 'thu_night'
  | 'sun_early'
  | 'sun_late_early'
  | 'sun_late_late'
  | 'sun_night'
  | 'mon_night';

type MockGameLine = {
  awayTeam: string;
  defaultScore: {
    away: number;
    home: number;
  };
  homeTeam: string;
  id: string;
  moneyline: {
    away: number;
    home: number;
  };
  slot: MockGameSlot;
  spread: {
    away: number;
    awayOdds: number;
    home: number;
    homeOdds: number;
  };
  total: {
    line: number;
    overOdds: number;
    underOdds: number;
  };
};

type MockGameSlotDefinition = {
  dayOffset: number;
  hourUtc: number;
  minuteUtc: number;
};

export type MockNflScore = {
  awayScore: number;
  awayTeam: string;
  gameId: string;
  homeScore: number;
  homeTeam: string;
};

const MOCK_BOOKMAKER_KEY = 'draftkings';
const MOCK_BOOKMAKER_TITLE = 'DraftKings';

const MOCK_SLOT_SCHEDULE: Record<MockGameSlot, MockGameSlotDefinition> = {
  mon_night: { dayOffset: 5, hourUtc: 0, minuteUtc: 15 },
  sun_early: { dayOffset: 3, hourUtc: 17, minuteUtc: 0 },
  sun_late_early: { dayOffset: 3, hourUtc: 20, minuteUtc: 5 },
  sun_late_late: { dayOffset: 3, hourUtc: 20, minuteUtc: 25 },
  sun_night: { dayOffset: 4, hourUtc: 0, minuteUtc: 20 },
  thu_night: { dayOffset: 1, hourUtc: 0, minuteUtc: 15 },
};

export const MOCK_NFL_WEEK_1_LINES: MockGameLine[] = [
  {
    awayTeam: 'Dallas Cowboys',
    defaultScore: { away: 24, home: 27 },
    homeTeam: 'Philadelphia Eagles',
    id: 'mock_nfl_w01_dal_phi',
    moneyline: { away: 120, home: -142 },
    slot: 'thu_night',
    spread: { away: 2.5, awayOdds: -110, home: -2.5, homeOdds: -110 },
    total: { line: 47.5, overOdds: -108, underOdds: -112 },
  },
  {
    awayTeam: 'Buffalo Bills',
    defaultScore: { away: 28, home: 20 },
    homeTeam: 'New York Jets',
    id: 'mock_nfl_w01_buf_nyj',
    moneyline: { away: -170, home: 145 },
    slot: 'sun_early',
    spread: { away: -3.5, awayOdds: -112, home: 3.5, homeOdds: -108 },
    total: { line: 44.5, overOdds: -110, underOdds: -110 },
  },
  {
    awayTeam: 'Cincinnati Bengals',
    defaultScore: { away: 24, home: 21 },
    homeTeam: 'Cleveland Browns',
    id: 'mock_nfl_w01_cin_cle',
    moneyline: { away: -125, home: 105 },
    slot: 'sun_early',
    spread: { away: -1.5, awayOdds: -110, home: 1.5, homeOdds: -110 },
    total: { line: 45.5, overOdds: -115, underOdds: -105 },
  },
  {
    awayTeam: 'Baltimore Ravens',
    defaultScore: { away: 20, home: 17 },
    homeTeam: 'Pittsburgh Steelers',
    id: 'mock_nfl_w01_bal_pit',
    moneyline: { away: -155, home: 135 },
    slot: 'sun_early',
    spread: { away: -3, awayOdds: -105, home: 3, homeOdds: -115 },
    total: { line: 40.5, overOdds: -110, underOdds: -110 },
  },
  {
    awayTeam: 'Jacksonville Jaguars',
    defaultScore: { away: 23, home: 26 },
    homeTeam: 'Indianapolis Colts',
    id: 'mock_nfl_w01_jax_ind',
    moneyline: { away: 115, home: -135 },
    slot: 'sun_early',
    spread: { away: 2.5, awayOdds: -108, home: -2.5, homeOdds: -112 },
    total: { line: 46.5, overOdds: -110, underOdds: -110 },
  },
  {
    awayTeam: 'Tennessee Titans',
    defaultScore: { away: 14, home: 31 },
    homeTeam: 'Houston Texans',
    id: 'mock_nfl_w01_ten_hou',
    moneyline: { away: 250, home: -300 },
    slot: 'sun_early',
    spread: { away: 10.5, awayOdds: -110, home: -10.5, homeOdds: -110 },
    total: { line: 43.5, overOdds: -105, underOdds: -115 },
  },
  {
    awayTeam: 'New England Patriots',
    defaultScore: { away: 20, home: 30 },
    homeTeam: 'Miami Dolphins',
    id: 'mock_nfl_w01_ne_mia',
    moneyline: { away: 190, home: -230 },
    slot: 'sun_early',
    spread: { away: 6.5, awayOdds: -110, home: -6.5, homeOdds: -110 },
    total: { line: 48.5, overOdds: -112, underOdds: -108 },
  },
  {
    awayTeam: 'Minnesota Vikings',
    defaultScore: { away: 21, home: 24 },
    homeTeam: 'Green Bay Packers',
    id: 'mock_nfl_w01_min_gb',
    moneyline: { away: 125, home: -145 },
    slot: 'sun_early',
    spread: { away: 2.5, awayOdds: -115, home: -2.5, homeOdds: -105 },
    total: { line: 44.5, overOdds: -110, underOdds: -110 },
  },
  {
    awayTeam: 'Atlanta Falcons',
    defaultScore: { away: 19, home: 17 },
    homeTeam: 'Carolina Panthers',
    id: 'mock_nfl_w01_atl_car',
    moneyline: { away: -115, home: -105 },
    slot: 'sun_early',
    spread: { away: -1.5, awayOdds: -110, home: 1.5, homeOdds: -110 },
    total: { line: 41.5, overOdds: -108, underOdds: -112 },
  },
  {
    awayTeam: 'Tampa Bay Buccaneers',
    defaultScore: { away: 23, home: 20 },
    homeTeam: 'New Orleans Saints',
    id: 'mock_nfl_w01_tb_no',
    moneyline: { away: -135, home: 115 },
    slot: 'sun_early',
    spread: { away: -2.5, awayOdds: -112, home: 2.5, homeOdds: -108 },
    total: { line: 42.5, overOdds: -110, underOdds: -110 },
  },
  {
    awayTeam: 'Washington Commanders',
    defaultScore: { away: 21, home: 16 },
    homeTeam: 'New York Giants',
    id: 'mock_nfl_w01_was_nyg',
    moneyline: { away: -125, home: 105 },
    slot: 'sun_early',
    spread: { away: -1.5, awayOdds: -105, home: 1.5, homeOdds: -115 },
    total: { line: 38.5, overOdds: -110, underOdds: -110 },
  },
  {
    awayTeam: 'San Francisco 49ers',
    defaultScore: { away: 27, home: 23 },
    homeTeam: 'Seattle Seahawks',
    id: 'mock_nfl_w01_sf_sea',
    moneyline: { away: -160, home: 140 },
    slot: 'sun_late_early',
    spread: { away: -3.5, awayOdds: -110, home: 3.5, homeOdds: -110 },
    total: { line: 45.5, overOdds: -108, underOdds: -112 },
  },
  {
    awayTeam: 'Kansas City Chiefs',
    defaultScore: { away: 34, home: 20 },
    homeTeam: 'Denver Broncos',
    id: 'mock_nfl_w01_kc_den',
    moneyline: { away: -300, home: 250 },
    slot: 'sun_late_late',
    spread: { away: -10.5, awayOdds: -110, home: 10.5, homeOdds: -110 },
    total: { line: 51.5, overOdds: -115, underOdds: -105 },
  },
  {
    awayTeam: 'Las Vegas Raiders',
    defaultScore: { away: 20, home: 27 },
    homeTeam: 'Los Angeles Chargers',
    id: 'mock_nfl_w01_lv_lac',
    moneyline: { away: 175, home: -205 },
    slot: 'sun_late_late',
    spread: { away: 5.5, awayOdds: -110, home: -5.5, homeOdds: -110 },
    total: { line: 47.5, overOdds: -110, underOdds: -110 },
  },
  {
    awayTeam: 'Detroit Lions',
    defaultScore: { away: 31, home: 28 },
    homeTeam: 'Chicago Bears',
    id: 'mock_nfl_w01_det_chi',
    moneyline: { away: -145, home: 125 },
    slot: 'sun_night',
    spread: { away: -2.5, awayOdds: -110, home: 2.5, homeOdds: -110 },
    total: { line: 54.5, overOdds: -112, underOdds: -108 },
  },
  {
    awayTeam: 'Los Angeles Rams',
    defaultScore: { away: 26, home: 24 },
    homeTeam: 'Arizona Cardinals',
    id: 'mock_nfl_w01_lar_ari',
    moneyline: { away: -120, home: 100 },
    slot: 'mon_night',
    spread: { away: -1.5, awayOdds: -108, home: 1.5, homeOdds: -112 },
    total: { line: 49.5, overOdds: -110, underOdds: -110 },
  },
];

function getNextMockThursday(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() + 2);
  const daysUntilThursday = (4 - start.getUTCDay() + 7) % 7;
  start.setUTCDate(start.getUTCDate() + daysUntilThursday);
  return start;
}

function getCommenceTime(slot: MockGameSlot, now = new Date()) {
  const baseThursday = getNextMockThursday(now);
  const slotDefinition = MOCK_SLOT_SCHEDULE[slot];
  const commenceTime = new Date(baseThursday);
  commenceTime.setUTCDate(baseThursday.getUTCDate() + slotDefinition.dayOffset);
  commenceTime.setUTCHours(slotDefinition.hourUtc, slotDefinition.minuteUtc, 0, 0);
  return commenceTime.toISOString();
}

function buildMarkets(game: MockGameLine, lastUpdate: string): OddsApiMarket[] {
  return [
    {
      key: 'h2h',
      last_update: lastUpdate,
      outcomes: [
        {
          name: game.awayTeam,
          price: game.moneyline.away,
          short_name: getNflTeamShortName(game.awayTeam),
        },
        {
          name: game.homeTeam,
          price: game.moneyline.home,
          short_name: getNflTeamShortName(game.homeTeam),
        },
      ],
    },
    {
      key: 'spreads',
      last_update: lastUpdate,
      outcomes: [
        {
          name: game.awayTeam,
          point: game.spread.away,
          price: game.spread.awayOdds,
          short_name: getNflTeamShortName(game.awayTeam),
        },
        {
          name: game.homeTeam,
          point: game.spread.home,
          price: game.spread.homeOdds,
          short_name: getNflTeamShortName(game.homeTeam),
        },
      ],
    },
    {
      key: 'totals',
      last_update: lastUpdate,
      outcomes: [
        {
          description: `${game.awayTeam} @ ${game.homeTeam}`,
          name: 'Over',
          point: game.total.line,
          price: game.total.overOdds,
        },
        {
          description: `${game.awayTeam} @ ${game.homeTeam}`,
          name: 'Under',
          point: game.total.line,
          price: game.total.underOdds,
        },
      ],
    },
  ];
}

export function getMockNflOddsApiGames(now = new Date()): OddsApiGame[] {
  const lastUpdate = now.toISOString();

  return MOCK_NFL_WEEK_1_LINES.map((game) => ({
    away_team: game.awayTeam,
    bookmakers: [
      {
        key: MOCK_BOOKMAKER_KEY,
        last_update: lastUpdate,
        markets: buildMarkets(game, lastUpdate),
        title: MOCK_BOOKMAKER_TITLE,
      },
    ],
    commence_time: getCommenceTime(game.slot, now),
    home_team: game.homeTeam,
    id: game.id,
    sport_key: 'americanfootball_nfl',
    sport_title: 'NFL',
  }));
}

export function getDefaultMockNflScores(): MockNflScore[] {
  return MOCK_NFL_WEEK_1_LINES.map((game) => ({
    awayScore: game.defaultScore.away,
    awayTeam: game.awayTeam,
    gameId: game.id,
    homeScore: game.defaultScore.home,
    homeTeam: game.homeTeam,
  }));
}
