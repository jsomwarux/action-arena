import { useState } from 'react';

import { useLocation, useNavigate, useSearchParams, type Location } from 'react-router-dom';

import { LegalDocumentCard } from '@/components/legal/LegalDocumentCard';
import { Notice } from '@/components/ui';
import { ACTION_ARENA_DISCLOSURE } from '@/constants/disclosure';
import { useAuth } from '@/hooks/use-auth';
import {
  hasSeenActionArenaDisclosure,
  useAcknowledgeActionArenaDisclosure,
} from '@/hooks/use-disclosure';
import { resolveLandingRoute } from '@/lib/post-auth';
import { ROUTES } from '@/lib/routes';

/**
 * Port of app/(app)/disclosure.tsx.
 *
 * Same gate as mobile: RequireAuth holds every in-app route here until the
 * player's user metadata carries the acknowledgement. Mobile's `?source=settings`
 * return path is preserved; web adds `state.from`, so a player bounced here
 * mid-flow (following an invite link, say) resumes where they were instead of
 * being dropped on the home screen. Mobile has no equivalent because nothing
 * there can deep-link into the app while unacknowledged.
 */
export function DisclosurePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const acknowledgeDisclosure = useAcknowledgeActionArenaDisclosure();
  const [error, setError] = useState<string | undefined>();

  const alreadySeen = hasSeenActionArenaDisclosure(user);
  const openedFromSettings = searchParams.get('source') === 'settings';
  const from = (location.state as { from?: Location } | null)?.from;

  const dismiss = async () => {
    setError(undefined);

    try {
      if (!alreadySeen) {
        await acknowledgeDisclosure.mutateAsync();
      }

      if (openedFromSettings) {
        navigate(ROUTES.settings, { replace: true });
        return;
      }

      if (from) {
        navigate(`${from.pathname}${from.search}`, { replace: true, state: from.state });
        return;
      }

      const landing = await resolveLandingRoute();
      navigate(landing.to, { replace: true, state: landing.state });
    } catch (dismissError) {
      setError(dismissError instanceof Error ? dismissError.message : 'Try again.');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <LegalDocumentCard
        body={ACTION_ARENA_DISCLOSURE.body}
        buttonLabel="Got It"
        buttonLoading={acknowledgeDisclosure.isPending}
        chips={ACTION_ARENA_DISCLOSURE.chips}
        onButtonPress={() => {
          void dismiss();
        }}
        title={ACTION_ARENA_DISCLOSURE.title}
      />

      {error ? <Notice tone="error">Could not save acknowledgement. {error}</Notice> : null}
    </div>
  );
}
