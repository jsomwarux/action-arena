import { useEffect, useState, type ComponentType } from 'react';

import { Activity, Flame, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { ArenaLogo, Button, Card } from '@/components/ui';
import { LOCAL_FLAG_KEYS, useLocalFlag } from '@/hooks/use-local-flags';
import { cn } from '@/lib/cn';
import { ROUTES } from '@/lib/routes';

type IntroSlide = {
  body: string;
  icon: ComponentType<{ className?: string }>;
  kicker: string;
  title: string;
};

/** Copy is identical to app/onboarding.tsx; Ionicons map onto lucide icons. */
const SLIDES: IntroSlide[] = [
  {
    body: 'Go head-to-head with your league on every spread, parlay, and weekly matchup. Free to play, no real money.',
    icon: Flame,
    kicker: 'Welcome',
    title: 'The fantasy sports league for prediction game lovers.',
  },
  {
    body: 'Join or create a league. Get matched up each week. Most coins wins.',
    icon: ShieldCheck,
    kicker: 'Leagues',
    title: 'Your weekly matchup is the main event.',
  },
  {
    body: 'Make picks across NFL games. Build multi-pick combos for higher rewards. Level up your strategy.',
    icon: Activity,
    kicker: 'Picks',
    title: 'Build your card.',
  },
];

const PICK_TYPE_EXAMPLES = [
  { accent: 'bg-electric-green', label: 'Straight', value: 'Chiefs -3.5' },
  { accent: 'bg-amber-accent', label: 'Parlay', value: '3 picks, bigger reward' },
  { accent: 'bg-cyan-accent', label: 'Teaser', value: '-7.5 → -1.5' },
] as const;

function PickTypeExample({
  accent,
  label,
  value,
}: {
  accent: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 xl:p-5">
      <span aria-hidden className={cn('mb-3 block h-1.5 w-8 rounded-full', accent)} />
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">{label}</p>
      <p className="mt-1 text-sm font-black text-white xl:text-base">{value}</p>
    </div>
  );
}

/**
 * Port of app/onboarding.tsx — same three slides, same copy, same exit (mark the
 * local onboarding-complete flag, land on /signup).
 *
 * The composition is deliberately not the mobile one. A phone pages through a
 * carousel because it has no room to show anything else; a desktop viewport
 * does, so the progression sits in a left rail beside the slide rather than
 * under it as dots. That makes the three slides read as a sequence a player can
 * see the shape of — and skip past — instead of a stack of unknown length.
 *
 * Consequences worth keeping if this screen is edited: the rail steps are the
 * dots (clickable, so no Back button is needed), the CTA is sized to its label
 * rather than stretched across the column, and this is the one route that
 * renders outside <AuthShell> because it is not a centred card.
 */
export function OnboardingPage() {
  const navigate = useNavigate();
  const onboardingFlag = useLocalFlag(LOCAL_FLAG_KEYS.onboardingComplete);
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];
  const Icon = slide.icon;

  const finish = async () => {
    await onboardingFlag.markComplete();
    navigate(ROUTES.signup, { replace: true });
  };

  const goNext = () => {
    if (isLast) {
      void finish();
      return;
    }

    setIndex((current) => current + 1);
  };

  // Arrow keys are the desktop equivalent of the mobile swipe.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        setIndex((current) => Math.min(current + 1, SLIDES.length - 1));
      }
      if (event.key === 'ArrowLeft') {
        setIndex((current) => Math.max(current - 1, 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-arena-bg">
      <span
        aria-hidden
        className="pointer-events-none absolute -left-64 -top-72 h-[52rem] w-[52rem] rounded-full bg-electric-green/[0.07] blur-3xl"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-80 -right-64 h-[46rem] w-[46rem] rounded-full bg-cyan-accent/[0.04] blur-3xl"
      />

      <header className="relative mx-auto flex w-full max-w-[88rem] items-start justify-between gap-6 px-8 py-8 lg:px-12">
        <ArenaLogo size="md" />
        <button
          className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/55 transition hover:bg-white/[0.08] hover:text-white"
          onClick={() => void finish()}
          type="button">
          Skip
        </button>
      </header>

      <main className="relative mx-auto flex w-full max-w-[88rem] flex-1 items-center px-8 pb-16 lg:px-12">
        <div className="grid w-full gap-10 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:gap-16 xl:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] xl:gap-20">
          {/* The progression, beside the slide instead of under it. */}
          <nav aria-label="Onboarding steps">
            <ol className="flex gap-2 lg:flex-col lg:gap-1">
              {SLIDES.map((item, itemIndex) => {
                const isActive = itemIndex === index;

                return (
                  <li className="flex-1 lg:flex-none" key={item.kicker}>
                    <button
                      aria-current={isActive}
                      className="group flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition lg:gap-4 lg:px-3"
                      onClick={() => setIndex(itemIndex)}
                      type="button">
                      <span
                        aria-hidden
                        className={cn(
                          'hidden w-0.5 rounded-full transition-all duration-300 ease-arena lg:block',
                          isActive ? 'h-9 bg-electric-green' : 'h-4 bg-white/15',
                        )}
                      />
                      <span
                        aria-hidden
                        className={cn(
                          'block h-0.5 flex-1 rounded-full transition-all duration-300 ease-arena lg:hidden',
                          isActive ? 'bg-electric-green' : 'bg-white/15',
                        )}
                      />
                      <span
                        className={cn(
                          'hidden font-mono text-[11px] tracking-[0.18em] transition lg:block',
                          isActive ? 'text-electric-green' : 'text-white/30',
                        )}>
                        {String(itemIndex + 1).padStart(2, '0')}
                      </span>
                      <span
                        className={cn(
                          'hidden text-sm font-black uppercase tracking-[0.16em] transition lg:block',
                          isActive ? 'text-white' : 'text-white/40 group-hover:text-white/70',
                        )}>
                        {item.kicker}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="flex flex-col">
            {/* key remounts the panel on slide change, replaying .arena-enter. */}
            <div className="arena-enter" key={slide.kicker}>
              <Card className="p-8 lg:p-10 xl:p-14">
                <div className="flex flex-col gap-7 xl:gap-9">
                  <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-electric-green/35 bg-electric-green/10 shadow-[0_0_26px_rgba(0,255,135,0.45)] xl:h-20 xl:w-20 xl:rounded-[26px]">
                    <Icon aria-hidden className="h-8 w-8 text-electric-green xl:h-10 xl:w-10" />
                  </div>

                  <div>
                    <h1 className="max-w-4xl text-3xl font-black uppercase leading-tight tracking-[-0.02em] text-white lg:text-4xl xl:text-5xl">
                      {slide.title}
                    </h1>
                    <p className="mt-4 max-w-3xl text-base font-semibold leading-7 text-white/60 lg:text-lg xl:mt-6 xl:text-xl xl:leading-8">
                      {slide.body}
                    </p>
                  </div>

                  {slide.kicker === 'Picks' ? (
                    <div className="grid gap-3 sm:grid-cols-3 xl:gap-4">
                      {PICK_TYPE_EXAMPLES.map((example) => (
                        <PickTypeExample
                          accent={example.accent}
                          key={example.label}
                          label={example.label}
                          value={example.value}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              </Card>
            </div>

            <div className="mt-8 flex items-center justify-between gap-6">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/35">
                {String(index + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
              </p>
              <Button
                fullWidth={false}
                onClick={goNext}
                title={isLast ? 'Create Account' : 'Next'}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
