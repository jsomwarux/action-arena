#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { callAdminRpc, hasFlag, loadDotEnv, readIntegerOption, requireIntegerOption } from './lib/admin-rpc.mjs';
import { MOCK_NFL_WEEK_1_GAMES } from './lib/mock-nfl-week-1.mjs';

function printHelp() {
  console.log(`Complete every non-fixture NFL league's games for a week and advance the global week.

Usage:
  node scripts/simulate-week-completion.mjs --week 1 --defaults
  node scripts/simulate-week-completion.mjs --week 1 mock_nfl_w01_dal_phi=27-24
  node scripts/simulate-week-completion.mjs --week 1 --scores ./scores.json

Score arguments use HOME-AWAY order. The first example score means:
  Philadelphia Eagles 27, Dallas Cowboys 24

scores.json may contain:
  [{ "id": "mock_nfl_w01_dal_phi", "home_score": 27, "away_score": 24 }]

The database validates that every known Week N game across non-fixture NFL leagues
has a supplied score before finalizing the week.

Environment:
  EXPO_PUBLIC_SUPABASE_URL must be set.
  SUPABASE_SERVICE_ROLE_KEY must be set because this is an admin-only tool.
`);
}

function parseScoreOverride(value) {
  const [homeScoreText, awayScoreText] = value.split('-');
  const homeScore = Number(homeScoreText);
  const awayScore = Number(awayScoreText);

  if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
    throw new Error(`Invalid score "${value}". Use HOME-AWAY, for example 27-24.`);
  }

  return { away_score: awayScore, home_score: homeScore };
}

function scoresFromArgs(args) {
  return args
    .filter((argument) => !argument.startsWith('--') && argument.includes('='))
    .map((argument) => {
      const [gameId, scoreText] = argument.split('=');

      if (!gameId || !scoreText) {
        throw new Error(`Invalid score argument "${argument}". Use game_id=HOME-AWAY.`);
      }

      return {
        id: gameId,
        ...parseScoreOverride(scoreText),
      };
    });
}

function scoresFromFile(args) {
  const optionIndex = args.indexOf('--scores');

  if (optionIndex === -1) {
    return null;
  }

  const filePath = args[optionIndex + 1];

  if (!filePath) {
    throw new Error('Expected a file path after --scores.');
  }

  const resolvedPath = resolve(process.cwd(), filePath);

  if (!existsSync(resolvedPath)) {
    throw new Error(`Scores file not found: ${resolvedPath}`);
  }

  const parsed = JSON.parse(readFileSync(resolvedPath, 'utf8'));

  if (!Array.isArray(parsed)) {
    throw new Error('Scores file must contain a JSON array.');
  }

  return parsed;
}

function defaultScores() {
  return MOCK_NFL_WEEK_1_GAMES.map((game) => ({
    away_score: game.awayScore,
    home_score: game.homeScore,
    id: game.gameId,
  }));
}

function selectedScores(args) {
  const fileScores = scoresFromFile(args);

  if (fileScores) {
    return fileScores;
  }

  if (hasFlag(args, '--defaults')) {
    return defaultScores();
  }

  const inlineScores = scoresFromArgs(args);

  if (inlineScores.length > 0) {
    return inlineScores;
  }

  throw new Error('Provide --defaults, --scores ./scores.json, or at least one game_id=HOME-AWAY score.');
}

async function main() {
  loadDotEnv();

  const args = process.argv.slice(2);

  if (hasFlag(args, '--help') || hasFlag(args, '-h')) {
    printHelp();
    return;
  }

  const weekNumber = requireIntegerOption(args, '--week');
  const seasonYear = readIntegerOption(args, '--season');
  const scores = selectedScores(args);

  const result = await callAdminRpc('simulate_global_week_completion', {
    p_scores: scores,
    p_season_year: seasonYear,
    p_week_number: weekNumber,
  });

  console.log(`Completed NFL Week ${weekNumber}${seasonYear ? ` (${seasonYear})` : ''}.`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
