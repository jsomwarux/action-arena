import type { Json, LeagueRow } from '@/types/database';

export type AppStoreCaptureMode = 'hook_prefill' | 'lineup_prefill';

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
