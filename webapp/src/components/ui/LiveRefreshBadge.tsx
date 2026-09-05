import { useEffect, useState } from 'react';

import { RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

import { THEME_COLORS } from '@/constants/theme';
import { cn } from '@/lib/cn';

function formatRelativeSeconds(seconds: number) {
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

/**
 * The quiet game-day status line: whether anything is live, when the data last
 * came back, and a manual refresh. Desktop-only — the phone refreshes on focus
 * and has no equivalent. Deliberately understated: this screen is meant to be
 * left open on a second monitor.
 */
export function LiveRefreshBadge({
  isLive,
  isRefreshing,
  lastRefreshedAt,
  onRefresh,
}: {
  isLive: boolean;
  isRefreshing: boolean;
  lastRefreshedAt: number;
  onRefresh: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(interval);
  }, []);

  const seconds = Math.max(0, Math.floor((now - lastRefreshedAt) / 1000));

  return (
    <div className="flex items-center gap-2">
      {isLive ? (
        <span className="flex items-center gap-1.5 rounded-full border border-coral-red/40 bg-coral-red/10 px-2.5 py-1">
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            aria-hidden
            className="h-1.5 w-1.5 rounded-full"
            initial={{ opacity: 1 }}
            style={{ backgroundColor: THEME_COLORS.coralRed }}
            transition={{ duration: 1.6, ease: 'easeInOut', repeat: Infinity }}
          />
          <span className="arena-label text-coral-red">
            Live
          </span>
        </span>
      ) : null}
      <button
        aria-label="Refresh"
        className="flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-2.5 py-1 arena-tag text-white/50 transition hover:bg-white/[0.08] hover:text-white/80 disabled:opacity-50"
        disabled={isRefreshing}
        onClick={onRefresh}
        type="button">
        <RefreshCw aria-hidden className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
        {isRefreshing ? 'Updating' : `Updated ${formatRelativeSeconds(seconds)}`}
      </button>
    </div>
  );
}
