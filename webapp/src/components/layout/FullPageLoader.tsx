import { Loader2 } from 'lucide-react';

/**
 * What a route guard renders while it does not yet know where the player
 * belongs. The mobile layouts show a bare ActivityIndicator on the arena
 * background for the same beat.
 */
export function FullPageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-arena-bg">
      <Loader2 aria-hidden className="h-7 w-7 animate-spin text-electric-green" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

/**
 * The same beat, sized for the content column rather than the viewport.
 *
 * AppShell suspends its <Outlet> on this while a lazy route's chunk loads. It
 * deliberately does not paint a background or claim the full height: the shell
 * around it is still on screen, so this only has to hold the column's place.
 */
export function ContentLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 aria-hidden className="h-7 w-7 animate-spin text-electric-green" />
      <span className="sr-only">{label}</span>
    </div>
  );
}
