import { Apple, Smartphone } from 'lucide-react';

import { Badge } from '@/components/ui';

/**
 * The honesty strip both real-money surfaces carry.
 *
 * Real-money purchases run through Apple In-App Purchase, which the browser has
 * no way to reach, so `useCoinPurchase` and `useSeasonPassPurchase` are ported
 * as stubs that always report the store as unavailable. Rather than wiring a
 * button to a call that can only fail, every purchase CTA on the web is
 * rendered disabled and this strip says why — the message comes straight off
 * the stub hook, so there is exactly one copy of the wording.
 *
 * Nothing here gates gameplay: leagues, picks, matchups, chat and standings are
 * free and unaffected, and Arena Coins already earned still spend in the shop.
 */
export function IosOnlyNotice({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-gold/35 bg-gold/[0.08] p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-gold/40 bg-gold/15">
          <Apple aria-hidden className="h-5 w-5 text-gold" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-gold">
              iOS App Only
            </p>
            <Badge icon={Smartphone} label="Web is read-only" tone="neutral" />
          </div>
          <p className="mt-1.5 text-sm font-semibold leading-6 text-white/65">{message}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * Labels for the disabled purchase controls.
 *
 * Short enough not to truncate in a three-up pack grid — the Button truncates
 * rather than wraps — and always paired with the notice above, which spells the
 * restriction out in full.
 */
export const IOS_ONLY_BUTTON_LABEL = 'iOS App Only';
export const IOS_ONLY_BUY_LABEL = 'Buy in the iOS App';
export const IOS_ONLY_RESTORE_LABEL = 'Restore in the iOS App';
