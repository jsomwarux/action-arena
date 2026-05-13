#!/usr/bin/env node

import { callAdminRpc, hasFlag, loadDotEnv, readIntegerOption, requireIntegerOption } from './lib/admin-rpc.mjs';

function printHelp() {
  console.log(`Kick off every non-fixture NFL league's games for a week.

Usage:
  node scripts/simulate-week-kickoff.mjs --week 1
  node scripts/simulate-week-kickoff.mjs --week 1 --season 2026

This marks every known Week N game across non-fixture NFL leagues as in progress,
updates canonical games, fans out slate times, and locks placed legs.

Environment:
  EXPO_PUBLIC_SUPABASE_URL must be set.
  SUPABASE_SERVICE_ROLE_KEY must be set because this is an admin-only tool.
`);
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

  const result = await callAdminRpc('simulate_global_week_kickoff', {
    p_season_year: seasonYear,
    p_week_number: weekNumber,
  });

  console.log(`Kicked off NFL Week ${weekNumber}${seasonYear ? ` (${seasonYear})` : ''}.`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
