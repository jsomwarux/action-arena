import { ChevronDown, UserCircle } from 'lucide-react';

/**
 * Top bar: league selector on the left, user menu on the right.
 *
 * Both are inert placeholders. TODO(webapp): the league selector becomes a real
 * dropdown once the leagues hook lands, and the user menu opens account /
 * settings / sign-out once auth lands.
 */
export function TopBar() {
  return (
    <header className="sticky top-0 z-20 flex h-topbar items-center justify-between gap-4 border-b border-border bg-arena-bg/80 px-6 backdrop-blur-xl">
      <button
        aria-label="Select league (not wired up yet)"
        className="flex min-w-0 items-center gap-2 rounded-xl border border-border bg-white/[0.04] px-3 py-2 text-left transition hover:bg-white/[0.07]"
        disabled
        type="button">
        <span className="flex flex-col">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-textMuted">
            League
          </span>
          <span className="truncate text-sm font-bold text-white/85">Select a league</span>
        </span>
        <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-white/45" />
      </button>

      <button
        aria-label="Account menu (not wired up yet)"
        className="flex items-center gap-2 rounded-xl border border-border bg-white/[0.04] px-3 py-2 transition hover:bg-white/[0.07]"
        disabled
        type="button">
        <UserCircle aria-hidden className="h-5 w-5 text-white/70" />
        <span className="text-sm font-bold text-white/85">Account</span>
        <ChevronDown aria-hidden className="h-4 w-4 text-white/45" />
      </button>
    </header>
  );
}
