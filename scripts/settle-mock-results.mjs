#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MOCK_GAMES = [
  {
    awayScore: 24,
    awayTeam: 'Dallas Cowboys',
    gameId: 'mock_nfl_w01_dal_phi',
    homeScore: 27,
    homeTeam: 'Philadelphia Eagles',
  },
  {
    awayScore: 28,
    awayTeam: 'Buffalo Bills',
    gameId: 'mock_nfl_w01_buf_nyj',
    homeScore: 20,
    homeTeam: 'New York Jets',
  },
  {
    awayScore: 24,
    awayTeam: 'Cincinnati Bengals',
    gameId: 'mock_nfl_w01_cin_cle',
    homeScore: 21,
    homeTeam: 'Cleveland Browns',
  },
  {
    awayScore: 20,
    awayTeam: 'Baltimore Ravens',
    gameId: 'mock_nfl_w01_bal_pit',
    homeScore: 17,
    homeTeam: 'Pittsburgh Steelers',
  },
  {
    awayScore: 23,
    awayTeam: 'Jacksonville Jaguars',
    gameId: 'mock_nfl_w01_jax_ind',
    homeScore: 26,
    homeTeam: 'Indianapolis Colts',
  },
  {
    awayScore: 14,
    awayTeam: 'Tennessee Titans',
    gameId: 'mock_nfl_w01_ten_hou',
    homeScore: 31,
    homeTeam: 'Houston Texans',
  },
  {
    awayScore: 20,
    awayTeam: 'New England Patriots',
    gameId: 'mock_nfl_w01_ne_mia',
    homeScore: 30,
    homeTeam: 'Miami Dolphins',
  },
  {
    awayScore: 21,
    awayTeam: 'Minnesota Vikings',
    gameId: 'mock_nfl_w01_min_gb',
    homeScore: 24,
    homeTeam: 'Green Bay Packers',
  },
  {
    awayScore: 19,
    awayTeam: 'Atlanta Falcons',
    gameId: 'mock_nfl_w01_atl_car',
    homeScore: 17,
    homeTeam: 'Carolina Panthers',
  },
  {
    awayScore: 23,
    awayTeam: 'Tampa Bay Buccaneers',
    gameId: 'mock_nfl_w01_tb_no',
    homeScore: 20,
    homeTeam: 'New Orleans Saints',
  },
  {
    awayScore: 21,
    awayTeam: 'Washington Commanders',
    gameId: 'mock_nfl_w01_was_nyg',
    homeScore: 16,
    homeTeam: 'New York Giants',
  },
  {
    awayScore: 27,
    awayTeam: 'San Francisco 49ers',
    gameId: 'mock_nfl_w01_sf_sea',
    homeScore: 23,
    homeTeam: 'Seattle Seahawks',
  },
  {
    awayScore: 34,
    awayTeam: 'Kansas City Chiefs',
    gameId: 'mock_nfl_w01_kc_den',
    homeScore: 20,
    homeTeam: 'Denver Broncos',
  },
  {
    awayScore: 20,
    awayTeam: 'Las Vegas Raiders',
    gameId: 'mock_nfl_w01_lv_lac',
    homeScore: 27,
    homeTeam: 'Los Angeles Chargers',
  },
  {
    awayScore: 31,
    awayTeam: 'Detroit Lions',
    gameId: 'mock_nfl_w01_det_chi',
    homeScore: 28,
    homeTeam: 'Chicago Bears',
  },
  {
    awayScore: 26,
    awayTeam: 'Los Angeles Rams',
    gameId: 'mock_nfl_w01_lar_ari',
    homeScore: 24,
    homeTeam: 'Arizona Cardinals',
  },
];

function loadDotEnv() {
  const envPath = resolve(process.cwd(), '.env');

  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');

    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim().replace(/^['"]|['"]$/g, '');

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function printHelp() {
  console.log(`Settle mock NFL game results through Supabase.

Usage:
  node scripts/settle-mock-results.mjs --defaults
  node scripts/settle-mock-results.mjs mock_nfl_w01_dal_phi=27-24

Score arguments use HOME-AWAY order. The example above means:
  Philadelphia Eagles 27, Dallas Cowboys 24

Environment:
  EXPO_PUBLIC_SUPABASE_URL must be set.
  SUPABASE_SERVICE_ROLE_KEY must be set because settlement is an admin RPC.
`);
}

function parseScoreOverride(value) {
  const [homeScoreText, awayScoreText] = value.split('-');
  const homeScore = Number(homeScoreText);
  const awayScore = Number(awayScoreText);

  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
    throw new Error(`Invalid score "${value}". Use HOME-AWAY, for example 27-24.`);
  }

  return { awayScore, homeScore };
}

function getSelectedScores(args) {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(args.length === 0 ? 1 : 0);
  }

  if (args.includes('--defaults')) {
    return MOCK_GAMES;
  }

  return args.map((argument) => {
    const [gameId, scoreText] = argument.split('=');

    if (!gameId || !scoreText) {
      throw new Error(`Invalid argument "${argument}". Use game_id=HOME-AWAY.`);
    }

    const game = MOCK_GAMES.find((item) => item.gameId === gameId);

    if (!game) {
      throw new Error(`Unknown mock game id "${gameId}". Run with --help for usage.`);
    }

    return {
      ...game,
      ...parseScoreOverride(scoreText),
    };
  });
}

function toOddsApiScorePayload(scores) {
  const lastUpdate = new Date().toISOString();

  return scores.map((score) => ({
    away_team: score.awayTeam,
    commence_time: lastUpdate,
    completed: true,
    home_team: score.homeTeam,
    id: score.gameId,
    last_update: lastUpdate,
    scores: [
      { name: score.homeTeam, score: String(score.homeScore) },
      { name: score.awayTeam, score: String(score.awayScore) },
    ],
    sport_key: 'americanfootball_nfl',
    sport_title: 'NFL',
  }));
}

async function settleScores(scores) {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL.');
  }

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY. Add it to your shell or .env for this admin script.');
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/settle_completed_scores`, {
    body: JSON.stringify({ p_scores: toOddsApiScorePayload(scores) }),
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Settlement failed with ${response.status}: ${body}`);
  }

  return body ? JSON.parse(body) : null;
}

async function main() {
  loadDotEnv();

  const scores = getSelectedScores(process.argv.slice(2));
  const result = await settleScores(scores);

  console.log(`Settled ${scores.length} mock game result${scores.length === 1 ? '' : 's'}.`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
