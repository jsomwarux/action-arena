import { Smartphone } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { ROUTES } from '@/lib/routes';

/**
 * What the notification toggles actually control.
 *
 * Every switch writes the same account fields the iOS app and the
 * `process-notifications` Edge Function read; the browser receives no push
 * either way. Two screens render that control surface — `/notifications/preferences`
 * and the Settings block — and only one of them used to say so, which left a
 * player who lives in Settings with no way to learn that the switches do nothing
 * in the browser they are sitting in.
 *
 * One component, so the caveat cannot travel without the controls again.
 */
export function PushScopeNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03]',
        compact ? 'p-3' : 'p-0',
      )}>
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.05] text-white/50',
          compact ? 'h-8 w-8' : 'h-10 w-10',
        )}>
        <Smartphone aria-hidden className={compact ? 'h-4 w-4' : 'h-[18px] w-[18px]'} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={cn(
              'font-bold uppercase tracking-[0.12em] text-white/50',
              compact ? 'text-[10px]' : 'text-[11px]',
            )}>
            These control push
          </p>
          <Badge label="Mobile only" tone="neutral" />
        </div>
        <p
          className={cn(
            'mt-1.5 font-medium text-white/55',
            compact ? 'text-xs leading-5' : 'text-sm leading-6',
          )}>
          Every switch below decides what the Action Arena iOS app is allowed to push to your phone.
          They save to your account from here, but this browser receives no push notifications
          either way — in the browser, all alerts appear in your{' '}
          <Link
            className="font-bold text-electric-green hover:underline"
            to={ROUTES.notifications}>
            in-app inbox
          </Link>
          , regardless of these settings.
        </p>
      </div>
    </div>
  );
}
