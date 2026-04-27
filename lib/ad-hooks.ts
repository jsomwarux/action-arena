import { logAnalyticsEvent } from './analytics';

export type AdHookPlacement = 'leaderboard_banner' | 'matchup_result_interstitial';

export function triggerAdHook({
  isSeasonPassHolder,
  placement,
  userId,
}: {
  isSeasonPassHolder: boolean;
  placement: AdHookPlacement;
  userId: string | undefined;
}) {
  if (isSeasonPassHolder || !userId) {
    return;
  }

  console.info('[ads]', 'ad would have shown here', { placement, userId });
  logAnalyticsEvent('ad_hook_triggered', {
    placement,
    user_id: userId,
  });
}
