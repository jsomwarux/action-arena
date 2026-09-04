import {
  CheckCircle2,
  Flame,
  Link2,
  Lock,
  Skull,
  Sparkles,
  TrendingUp,
  Trophy,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

import { THEME_COLORS } from '@/constants/theme';
import type { AchievementDisplay } from '@/hooks/use-profile-stats';
import { cn } from '@/lib/cn';
import type { AchievementKey } from '@/types/database';

import { SectionLabel } from './SectionLabel';

/** Same glyph per achievement as mobile's ACHIEVEMENT_ICONS, as lucide icons. */
const ACHIEVEMENT_ICONS: Record<AchievementKey, LucideIcon> = {
  budget_master: Wallet,
  hot_streak: Flame,
  parlay_king: Link2,
  perfect_week: Sparkles,
  teaser_genius: TrendingUp,
  underdog_hunter: Skull,
};

function AchievementBadge({ achievement }: { achievement: AchievementDisplay }) {
  const Icon = achievement.earned
    ? (ACHIEVEMENT_ICONS[achievement.key] ?? Trophy)
    : Lock;

  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-2xl border p-3',
        achievement.earned
          ? 'border-gold/45 bg-gold/[0.10]'
          : 'border-white/[0.07] bg-white/[0.03]',
      )}>
      <span
        className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border',
          achievement.earned
            ? 'border-gold/55 bg-gold/15'
            : 'border-white/10 bg-white/[0.04]',
        )}
        style={
          achievement.earned ? { boxShadow: `0 0 10px ${THEME_COLORS.gold}80` } : undefined
        }>
        <Icon
          aria-hidden
          className="h-5 w-5"
          style={{ color: achievement.earned ? THEME_COLORS.gold : 'rgba(255,255,255,0.32)' }}
        />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p
            className={cn(
              'truncate text-sm font-black uppercase tracking-[0.6px]',
              achievement.earned ? 'text-gold' : 'text-white/55',
            )}>
            {achievement.title}
          </p>
          {achievement.earned ? (
            <CheckCircle2 aria-hidden className="h-3.5 w-3.5 shrink-0 text-gold" />
          ) : null}
        </div>
        <p
          className={cn(
            'mt-1 text-xs font-semibold',
            achievement.earned ? 'text-white/65' : 'text-white/40',
          )}>
          {achievement.description}
        </p>
      </div>

      {achievement.earned ? null : (
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-black uppercase tracking-[1.3px] text-white/45">
          Not earned
        </span>
      )}
    </li>
  );
}

export function Achievements({ achievements }: { achievements: AchievementDisplay[] }) {
  const earnedCount = achievements.filter((achievement) => achievement.earned).length;

  return (
    <section className="flex flex-col gap-3">
      <SectionLabel
        caption={`${earnedCount}/${achievements.length} unlocked`}
        title="Achievements"
        tone="gold"
      />
      {/* Six badges: three across on desktop instead of the phone's single
          column, so the whole set is legible without scrolling. */}
      <ul className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
        {achievements.map((achievement) => (
          <AchievementBadge achievement={achievement} key={achievement.key} />
        ))}
      </ul>
    </section>
  );
}
