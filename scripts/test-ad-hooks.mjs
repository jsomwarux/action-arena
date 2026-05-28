import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
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

function walkSourceFiles(path) {
  const absolutePath = join(rootDir, path);

  if (!existsSync(absolutePath)) {
    return [];
  }

  return readdirSync(absolutePath).flatMap((entry) => {
    const child = join(absolutePath, entry);
    const stats = statSync(child);

    if (stats.isDirectory()) {
      return walkSourceFiles(relative(rootDir, child));
    }

    if (!/\.(tsx?|jsx?)$/.test(entry)) {
      return [];
    }

    return [relative(rootDir, child)];
  });
}

const packageJson = JSON.parse(readProjectFile('package.json'));
const dependencyNames = new Set([
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.devDependencies ?? {}),
]);
const bannedAdPackages = [
  '@react-native-firebase/admob',
  'expo-ads-admob',
  'react-native-admob',
  'react-native-google-mobile-ads',
];

assertCheck(
  '25.1 no ad SDK package is installed',
  bannedAdPackages.every((packageName) => !dependencyNames.has(packageName)),
  `found one of: ${bannedAdPackages.join(', ')}`,
);

const appUiFiles = [
  ...walkSourceFiles('app'),
  ...walkSourceFiles('components'),
];
const bannedVisibleAdPatterns = [
  /\bAdMob\b/,
  /\bAdView\b/,
  /\bBannerAd\b/,
  /\bGADBanner\b/,
  /\bInterstitialAd\b/,
  /\bRewardedAd\b/,
  /\badUnitId\b/,
];
const visibleAdMatches = appUiFiles.flatMap((path) => {
  const source = readProjectFile(path);
  return bannedVisibleAdPatterns
    .filter((pattern) => pattern.test(source))
    .map((pattern) => `${path} matched ${pattern}`);
});

assertCheck(
  '25.1 and 25.2 no visible ad views or placeholders are rendered',
  visibleAdMatches.length === 0,
  visibleAdMatches.join('; '),
);

const adHooksSource = readProjectFile('lib/ad-hooks.ts');

assertCheck(
  '25.1 ad hook helper stays non-visual',
  !/from ['"]react-native['"]/.test(adHooksSource) &&
    !bannedVisibleAdPatterns.some((pattern) => pattern.test(adHooksSource)),
  'ad hook helper should not import React Native or ad UI components',
);

assertCheck(
  '25.2 Season Pass holders never trigger ad hooks',
  /if \(isSeasonPassHolder \|\| !userId\) \{\s*return;\s*\}/s.test(adHooksSource),
  'expected early return before analytics logging',
);

assertCheck(
  '25.1 free-user hooks are console and analytics only',
  adHooksSource.includes("console.info('[ads]'") &&
    adHooksSource.includes("logAnalyticsEvent('ad_hook_triggered'"),
  'expected placeholder console log plus analytics event',
);

const leaderboardSource = readProjectFile('app/(app)/(tabs)/leaderboard.tsx');
const matchupSource = readProjectFile('app/(app)/(tabs)/matchups/[matchupId].tsx');

assertCheck(
  '25.1 leaderboard banner hook is wired invisibly',
  leaderboardSource.includes("placement: 'leaderboard_banner'") &&
    leaderboardSource.includes('triggerAdHook({') &&
    leaderboardSource.includes('isSeasonPassHolder: Boolean(seasonPassQuery.data)'),
  'leaderboard should call triggerAdHook with Season Pass status',
);

assertCheck(
  '25.1 matchup result interstitial hook is wired invisibly',
  matchupSource.includes("placement: 'matchup_result_interstitial'") &&
    matchupSource.includes('triggerAdHook({') &&
    matchupSource.includes('isSeasonPassHolder: Boolean(seasonPassQuery.data)'),
  'matchup result should call triggerAdHook with Season Pass status',
);

const analyticsSource = readProjectFile('app/(app)/analytics.tsx');

assertCheck(
  '25.3 analytics unlock is Season Pass only',
  analyticsSource.includes('const hasAnalyticsAccess = hasSeasonPass;') &&
    /!\s*hasAnalyticsAccess\s*\?\s*\(\s*<LockedAnalyticsPreview/s.test(analyticsSource),
  'Strategy Lab should render the locked preview unless the user has Season Pass access',
);

assertCheck(
  '25.3 analytics screen has no rewarded-video test scaffold',
  !analyticsSource.includes('Watch video to unlock stats') &&
    !analyticsSource.includes('Video Unlock Active') &&
    !analyticsSource.includes('setRewardedUnlock(true);') &&
    !analyticsSource.includes("logAnalyticsEvent('rewarded_unlock_triggered'") &&
    !analyticsSource.includes('for testing') &&
    !analyticsSource.includes('placeholder'),
  'production analytics UI must not expose rewarded-video placeholders or testing copy',
);

if (failures.length > 0) {
  console.error('Ad Hooks regression failed:');
  failures.forEach((failure) => {
    console.error(`- ${failure.name}${failure.detail ? `: ${failure.detail}` : ''}`);
  });
  process.exit(1);
}

console.log('Test 25 Ad Hooks regression passed.');
