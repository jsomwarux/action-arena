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
