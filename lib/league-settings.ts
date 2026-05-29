import type { Json, LeagueRow } from '@/types/database';

export type AppStoreCaptureMode = 'hook_prefill' | 'lineup_prefill';

const publicBrowseBlockedLeagueNamePatterns = [
  /^app review demo league$/i,
  /^delete (commissioned|regular)\b/i,
  /^full league test\b/i,
  /^3 person league$/i,
  /\bapp store screenshot league\b/i,
  /\blineup builder league\b/i,
  /\bpublic test league\b/i,
  /\bqa manual regression\b/i,
  /\bsunday card league\b/i,
  /\btest (cumulative|h2h|league)\b/i,
];

export function isJsonRecord(value: Json | null | undefined): value is { [key: string]: Json | undefined } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getAppStoreCaptureMode(league: LeagueRow | undefined): AppStoreCaptureMode | null {
  if (!isJsonRecord(league?.settings)) {
    return null;
  }

  const mode = league.settings.app_store_capture_mode;
  return mode === 'hook_prefill' || mode === 'lineup_prefill' ? mode : null;
}

export function isGlobalWeekFixture(league: LeagueRow | undefined) {
  if (!isJsonRecord(league?.settings)) {
    return false;
  }

  return (
    league.settings.global_week_exempt === true &&
    league.settings.global_week_test_fixture === true
  );
}

function hasPublicBrowseBlockingSetting(league: LeagueRow) {
  if (!isJsonRecord(league.settings)) {
    return false;
  }

  return (
    league.settings.app_store_screenshot_fixture === true ||
    league.settings.global_week_test_fixture === true ||
    league.settings.manual_regression_fixture === true ||
    league.settings.public_browse_hidden === true ||
    league.settings.test_fixture === true ||
    typeof league.settings.app_store_capture_mode === 'string' ||
    typeof league.settings.fixture_key === 'string'
  );
}

export function isPublicBrowseEligibleLeague(league: LeagueRow) {
  if (league.visibility !== 'public') {
    return false;
  }

  if (hasPublicBrowseBlockingSetting(league)) {
    return false;
  }

  const normalizedName = league.name.trim();
  return !publicBrowseBlockedLeagueNamePatterns.some((pattern) => pattern.test(normalizedName));
}
