import { AlertTriangle, RotateCw } from 'lucide-react';

import { cn } from '@/lib/cn';

import { Button } from './Button';

/**
 * The error branch every data screen needs.
 *
 * Without it, a screen that reads `query.data ?? []` funnels a *failed* fetch
 * into its empty state, and then confidently tells the player "No picks placed
 * for this matchup" or "You haven't submitted any picks yet" — materially
 * alarming things to say to someone whose picks merely failed to load. An empty
 * state has to mean empty.
 *
 * `retry` takes the query's own `refetch`. The message is the server's where
 * there is one: RLS denials and Postgres `raise exception` text are the useful
 * half of what goes wrong here, and hiding them behind "Something went wrong"
 * costs the player the one clue they had.
 */
export function QueryErrorState({
  className,
  error,
  fallback = 'We could not load this right now.',
  onRetry,
  retrying,
  title = 'Could Not Load',
}: {
  className?: string;
  error?: unknown;
  fallback?: string;
  onRetry?: () => void;
  retrying?: boolean;
  title?: string;
}) {
  const message = error instanceof Error && error.message ? error.message : fallback;

  return (
    <div
      className={cn('flex flex-col items-center gap-3 px-4 py-8 text-center', className)}
      role="alert">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-coral-red/30 bg-coral-red/10 text-coral-red">
        <AlertTriangle aria-hidden className="h-6 w-6" />
      </span>
      <h3 className="arena-heading text-2xl leading-none">{title}</h3>
      <p className="max-w-md text-sm font-semibold leading-5 text-white/55">{message}</p>
      {onRetry ? (
        <Button
          fullWidth={false}
          icon={RotateCw}
          loading={retrying}
          onClick={onRetry}
          title="Try Again"
          variant="secondary"
        />
      ) : null}
    </div>
  );
}
