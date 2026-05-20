import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];

function readProjectFile(path) {
  return readFileSync(join(rootDir, path), 'utf8');
}

function assertCheck(name, passed, detail = '') {
  if (!passed) {
    failures.push({ detail, name });
  }
}

function hasAll(source, values) {
  return values.every((value) => source.includes(value));
}

function excerpt(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  if (start === -1) return '';
  const end = source.indexOf(endNeedle, start);
  return end === -1 ? source.slice(start) : source.slice(start, end);
}

function hasNumberOfLinesNear(source, needle, radius = 1000) {
  const index = source.indexOf(needle);
  if (index === -1) return false;
  return source.slice(Math.max(0, index - radius), index + radius).includes('numberOfLines={1}');
}

const packageJson = JSON.parse(readProjectFile('package.json'));
const straightBetsSource = readProjectFile('hooks/use-straight-bets.ts');
const betBoardSource = readProjectFile('app/(app)/(tabs)/bet-board.tsx');
const oddsSource = readProjectFile('lib/odds-api.ts');
const leaguesSource = readProjectFile('hooks/use-leagues.ts');
const memberDisplaySource = readProjectFile('lib/league-member-display.ts');
const settingsSource = readProjectFile('app/(app)/settings.tsx');
const profileContentSource = readProjectFile('components/profile/profile-content.tsx');
const leagueDetailSource = readProjectFile('app/(app)/(tabs)/leagues/[leagueId].tsx');
const leaderboardSource = readProjectFile('app/(app)/(tabs)/leaderboard.tsx');
const matchupSource = readProjectFile('app/(app)/(tabs)/matchups/[matchupId].tsx');
const duplicateGuardMigration = readProjectFile(
  'supabase/migrations/20260518193000_guard_duplicate_weekly_submissions.sql',
);

const handleConfirmSource = excerpt(
  betBoardSource,
  'const handleConfirm = async () => {',
  'const handleOpenPlacedBetEdit',
);
const handleConfirmCatch = excerpt(handleConfirmSource, '} catch (error) {', '  };');

assertCheck(
  '27.1 network loss returns a retryable message',
  hasAll(straightBetsSource, [
    'Network connection lost.',
    'Your lineup is still in the slip',
    'reconnect and submit again',
  ]),
  'submit errors should tell the player the slip is preserved',
);

assertCheck(
  '27.1 submit slip is only cleared after a successful mutation',
  handleConfirmSource.indexOf('await submitBets.mutateAsync(slipBets);') !== -1 &&
    handleConfirmSource.indexOf('await submitBets.mutateAsync(slipBets);') <
      handleConfirmSource.indexOf('setSlipBets([]);') &&
    !handleConfirmCatch.includes('setSlipBets([]);'),
  'failed submissions must leave the current slip intact',
);

assertCheck(
  '27.2 invalid Odds API responses show friendly errors',
  hasAll(oddsSource, [
    'Unable to load odds. Check the Odds API key, then try again.',
    'Unable to load odds right now. Check your connection, then try again.',
    'Unable to load odds right now. The Odds API returned status',
  ]),
  'fetch failures and auth failures should not surface raw request errors',
);

assertCheck(
  '27.2 mock odds remain available when mock mode is enabled',
  hasAll(oddsSource, ['if (isUsingMockOdds)', 'getMockNflOddsApiGames()', 'normalizeOddsApiGame']),
  'mock mode should bypass live API failures',
);

assertCheck(
  '27.3 rapid taps do not duplicate builder selections',
  /currentLegs\.some\(\(leg\) => leg\.selectionKey === nextLeg\.selectionKey\)/.test(
    betBoardSource,
  ) &&
    betBoardSource.includes(
      'return currentLegs.filter((leg) => leg.selectionKey !== nextLeg.selectionKey);',
    ),
  'builder taps should toggle by stable selection key',
);

assertCheck(
  '27.3 slip additions replace existing pick ids',
  betBoardSource.includes('current.filter((bet) => bet.id !== nextBet.id)') &&
    (betBoardSource.match(/current\.filter\(\(item\) => item\.id !== bet\.id\)/g) ?? [])
      .length >= 2,
  'straight, parlay, and teaser saves should replace existing slip rows',
);

assertCheck(
  '27.3 duplicate submit taps are ignored while pending',
  handleConfirmSource.includes('if (submitBets.isPending)') && handleConfirmSource.includes('return;'),
  'confirm handler should no-op while the mutation is in flight',
);

assertCheck(
  '27.4 leave-league confirmation warns that the action is permanent',
  hasAll(settingsSource, [
    'Leave league?',
    'permanent and cannot be undone',
    'past matchups remain visible',
  ]),
  'leave confirmation copy should warn before destructive removal',
);

assertCheck(
  '27.4 league standings exclude users who left',
  hasAll(leaguesSource, [
    'const activeMemberIds = new Set',
    'activeMemberIds.has(standing.user_id)',
    'matchups.flatMap',
  ]),
  'detail hook should filter standings by active members while still loading matchup profiles',
);

assertCheck(
  '27.5 long names truncate in league standings and chat',
  hasNumberOfLinesNear(leagueDetailSource, '{primaryName}') &&
    hasNumberOfLinesNear(leagueDetailSource, '{displayName}'),
  'league surfaces should keep long names on one line',
);

assertCheck(
  '27.5 long names truncate in leaderboard, matchup, and profile cards',
  hasNumberOfLinesNear(leaderboardSource, '{displayName}') &&
    hasNumberOfLinesNear(matchupSource, '{name}') &&
    hasNumberOfLinesNear(profileContentSource, '{headerTitle}'),
  'primary profile-style surfaces should constrain display-name text',
);

assertCheck(
  '27.5 league team names are primary with username fallback',
  hasAll(memberDisplaySource, [
    'getLeagueMemberPrimaryName',
    'teamName || displayName || fallback',
    'getLeagueMemberSecondaryName',
  ]) &&
    hasAll(leagueDetailSource, ['YourTeamCard', 'TeamNameEditorModal']) &&
    hasAll(matchupSource, ['getLeagueMemberPrimaryName(detail.homeMember', 'getLeagueMemberPrimaryName(detail.awayMember']) &&
    hasAll(leaderboardSource, ['getLeagueMemberPrimaryName(row.member', 'getLeagueMemberSecondaryName(row.member']),
  'in-league surfaces should render team names as the primary member identifier',
);

assertCheck(
  '27.5 users can edit per-league team names',
  hasAll(leaguesSource, [
    'useUpdateLeagueTeamNameMutation',
    ".from('league_members')",
    '.update({ team_name: trimmedTeamName })',
    'TEAM_NAME_MAX_LENGTH',
  ]),
  'team-name edits should update the league_members row with client validation',
);

assertCheck(
  '27.6 duplicate weekly submissions are serialized and rejected',
  hasAll(duplicateGuardMigration, [
    'pg_advisory_xact_lock',
    'submit_bets_without_submission_guard',
    'Bets have already been submitted for this week',
    'revoke execute on function public.submit_bets_without_submission_guard',
  ]),
  'backend submit RPC should protect same user/league/week under concurrency',
);

assertCheck(
  '27.6 already-submitted errors are player-friendly',
  hasAll(straightBetsSource, [
    'already been submitted for this week',
    'Picks have already been submitted for this week.',
  ]),
  'duplicate RPC errors should be normalized for the Bet Board alert',
);

assertCheck(
  '27 regression scripts are registered',
  packageJson.scripts?.['test:edge-cases:source'] === 'node scripts/test-edge-cases.mjs' &&
    packageJson.scripts?.['test:edge-cases:db'] ===
      'supabase db query --linked -f scripts/test-edge-cases.sql',
  'package scripts should expose source and DB edge-case checks',
);

if (failures.length > 0) {
  console.error('Test 27 Edge Cases source regression failed:');
  failures.forEach((failure) => {
    console.error(`- ${failure.name}${failure.detail ? `: ${failure.detail}` : ''}`);
  });
  process.exit(1);
}

console.log('Test 27 Edge Cases source regression passed.');
