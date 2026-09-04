import { cn } from '@/lib/cn';

export type ArenaLogoProps = {
  /** Mobile passes `className="items-center"`; on web that is this prop. */
  align?: 'center' | 'start';
  className?: string;
  eyebrow?: string;
  size?: 'lg' | 'md';
};

/**
 * Port of components/ui/arena-logo.tsx.
 *
 * Mobile sizes the wordmark with explicit fontSize/lineHeight because it has no
 * type scale; on web the same job is done by the `arena-heading` component class
 * (Bebas Neue), so the two sizes map onto Tailwind text sizes instead.
 */
export function ArenaLogo({
  align = 'start',
  className,
  eyebrow = 'ACTION · ARENA',
  size = 'lg',
}: ArenaLogoProps) {
  const wordmarkClass = size === 'lg' ? 'text-5xl' : 'text-4xl';
  const isCentered = align === 'center';

  return (
    <div
      className={cn(
        'flex flex-col',
        isCentered ? 'items-center text-center' : 'items-start',
        className,
      )}>
      <div className="flex items-center">
        <span aria-hidden className="mr-3 h-3 w-3 rounded-full bg-electric-green" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-electric-green">
          {eyebrow}
        </span>
      </div>

      <div className={cn('mt-3 flex flex-col', isCentered && 'items-center')}>
        <span className={cn('arena-heading leading-none', wordmarkClass)}>Action</span>
        <span className={cn('arena-heading leading-none text-electric-green', wordmarkClass)}>
          Arena
        </span>
      </div>

      <span aria-hidden className="mt-4 h-1 w-14 rounded-full bg-electric-green" />
    </div>
  );
}
