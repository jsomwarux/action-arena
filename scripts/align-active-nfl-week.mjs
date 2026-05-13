#!/usr/bin/env node

import { callAdminRpc, hasFlag, loadDotEnv, readIntegerOption, requireIntegerOption } from './lib/admin-rpc.mjs';

function printHelp() {
  console.log(`Align every NFL league to one global current week.

Usage:
  node scripts/align-active-nfl-week.mjs --week 1 --dry-run
  node scripts/align-active-nfl-week.mjs --week 1
  node scripts/align-active-nfl-week.mjs --week 2 --season 2026 --keep-future-artifacts

Options:
  --week N                  Required target week, 1-17.
  --season YYYY             Optional season year. Defaults to the active global NFL season.
  --dry-run                 Report changes without moving weeks or deleting future artifacts.
  --keep-future-artifacts   Do not prune future matchups/slate rows when moving leagues back.

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

  const targetWeek = requireIntegerOption(args, '--week');
  const seasonYear = readIntegerOption(args, '--season');
  const dryRun = hasFlag(args, '--dry-run');
  const pruneFutureArtifacts = !hasFlag(args, '--keep-future-artifacts');

  const result = await callAdminRpc('align_nfl_leagues_to_week', {
    p_dry_run: dryRun,
    p_prune_future_artifacts: pruneFutureArtifacts,
    p_season_year: seasonYear,
    p_target_week: targetWeek,
  });

  console.log(
    `${dryRun ? 'Previewed' : 'Aligned'} NFL leagues to Week ${targetWeek}${
      seasonYear ? ` (${seasonYear})` : ''
    }.`,
  );
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
