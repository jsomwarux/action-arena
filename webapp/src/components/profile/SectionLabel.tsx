import { cn } from '@/lib/cn';

/**
 * The green rule + caps label that heads every block on the profile surfaces.
 * Port of the mobile SectionLabel, with the `gold` variant the achievements
 * block uses.
 */
export function SectionLabel({
  caption,
  title,
  tone = 'green',
}: {
  caption?: string;
  title: string;
  tone?: 'gold' | 'green';
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={cn('h-1 w-6 rounded-full', tone === 'gold' ? 'bg-gold' : 'bg-electric-green')}
        />
        <h2
          className={cn(
            'text-xs font-black uppercase tracking-[2.2px]',
            tone === 'gold' ? 'text-gold' : 'text-electric-green',
          )}>
          {title}
        </h2>
      </div>
      {caption ? (
        <p className="shrink-0 text-xs font-semibold text-white/55">{caption}</p>
      ) : null}
    </div>
  );
}
