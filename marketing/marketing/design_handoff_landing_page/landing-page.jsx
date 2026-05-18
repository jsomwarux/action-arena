// landing-page.jsx — Action Arena marketing landing page.
// Composes: top nav, hero carousel (4 states), how-it-works 3-step strip, footer.
// Single component, two variants: 'mobile' (390px) and 'desktop' (1440px).
//
// Carousel behaviour (per INTAKE + answer notes):
//   • 4 states cycle: STRAIGHT → PARLAY → TEASER → LOCK
//   • Auto-advances on mount; first user interaction (tab/arrow/dot click)
//     stops the auto-cycle for that session
//   • All transitions = 650ms / cubic-bezier(0.4, 0, 0.2, 1)
//   • Animation lock: 650ms isAnimating guard between transitions
//   • Background tint, ghost text, and active card transition together
//
// Reads from the global `tweaks` object owned by App (in index HTML).

const STATES = ['straight', 'parlay', 'teaser', 'lock'];

const STATE_META = {
  straight: {
    label: 'STRAIGHT',
    ghost: 'STRAIGHT',
    accent: '#00FF87',         // electric-green
    tint:   '152 100% 50%',    // hsl
    Card:   () => <StraightCard />,
  },
  parlay: {
    label: 'PARLAY',
    ghost: 'PARLAY',
    accent: '#FFA502',
    tint:   '39 100% 50%',
    Card:   () => <ParlayCard />,
  },
  teaser: {
    label: 'TEASER',
    ghost: 'TEASER',
    accent: '#18DCFF',
    tint:   '189 100% 55%',
    Card:   () => <TeaserCard />,
  },
  lock: {
    label: 'LOCK',
    ghost: 'LOCK',
    accent: '#FFD700',
    tint:   '51 100% 50%',
    Card:   () => <LockCard />,
  },
};

const HEADLINES = {
  A: { eyebrow: 'NFL pick league · weeks 1–18',  big: ['Settle it', 'in the Arena.'],            deck: 'Your league. Your locks. Your bragging rights — every Sunday for 18 weeks.' },
  B: { eyebrow: 'Private leagues with friends',  big: ['A private NFL pick league', 'for you and your friends.'], deck: 'Build a lineup against a weekly virtual-coin budget. Outpick your friends. Climb the standings.' },
  C: { eyebrow: '$100 weekly virtual budget',    big: ['Spend smarter', 'than your friends.'],   deck: '$100 a week, one Lock, eighteen weeks. The friend who allocates best takes the season.' },
};

const INTENSITY = { subtle: 0.06, bold: 0.14, extreme: 0.28 };
// Preload nothing (cards are React) but trigger a layout warm-up so initial
// state change is as smooth as a subsequent one.
function useWarmupOnMount(cb) {
  React.useEffect(() => { requestAnimationFrame(cb); }, []);
}

// Carousel state is owned at the App level so both artboards stay in sync
// and the Tweaks panel can drive it. The hook exposes the same shape both
// landing instances need.
function useCarousel(tweaks, setTweak) {
  const isAnimating = React.useRef(false);
  // First-interaction kills auto-advance for the rest of the session.
  const [userInteracted, setUserInteracted] = React.useState(false);

  // Sync activeState into tweaks (the Tweaks panel reads the same key).
  const activeIdx = STATES.indexOf(tweaks.activeState);
  const setActive = React.useCallback((next, fromUser) => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    setTimeout(() => { isAnimating.current = false; }, 650);
    if (fromUser) setUserInteracted(true);
    setTweak('activeState', STATES[((next % 4) + 4) % 4]);
  }, [setTweak]);

  React.useEffect(() => {
    if (!tweaks.autoAdvance || userInteracted) return undefined;
    const id = setInterval(() => {
      const cur = STATES.indexOf(tweaks.activeState);
      setTweak('activeState', STATES[((cur + 1) % 4 + 4) % 4]);
    }, tweaks.autoInterval);
    return () => clearInterval(id);
    // Re-create the interval whenever the active state advances (so cadence
    // restarts cleanly from each tick) or when the interval/enabled flag
    // changes. The interval reads from a closure on tweaks.activeState that
    // would otherwise go stale.
  }, [tweaks.activeState, tweaks.autoAdvance, tweaks.autoInterval, userInteracted, setTweak]);

  return { activeIdx, active: tweaks.activeState, setActive };
}

// ────────────────────────────────────────────────────────────────
// Hero — ghost text + carousel stage + state tabs
// ────────────────────────────────────────────────────────────────
function Hero({ tweaks, setTweak, variant }) {
  const { active, setActive } = useCarousel(tweaks, setTweak);
  const meta = STATE_META[active];
  const intensity = INTENSITY[tweaks.bgIntensity] || INTENSITY.bold;
  const headline = HEADLINES[tweaks.headline] || HEADLINES.A;
  const isMobile = variant === 'mobile';

  // Reduced motion: instantly switch, no fade/scale on incoming card.
  const transitionMs = tweaks.reducedMotion ? 0 : 650;
  const easing = 'cubic-bezier(0.4, 0, 0.2, 1)';

  return (
    <section
      data-screen-label="01 Hero"
      style={{
        position: 'relative',
        background: '#0A0E1A',
        color: '#F8FAFC',
        overflow: 'hidden',
        minHeight: isMobile ? 760 : 880,
        padding: isMobile ? '20px 20px 36px' : '24px 56px 56px',
      }}
    >
      {/* State-tinted radial glow background */}
      <div
        aria-hidden
        style={{
          position: 'absolute', inset: 0,
          background: isMobile
            ? `radial-gradient(ellipse 80% 60% at 50% 45%, hsla(${meta.tint} / ${intensity}), transparent 70%)`
            : `radial-gradient(ellipse 50% 70% at 70% 50%, hsla(${meta.tint} / ${intensity}), transparent 70%)`,
          transition: `background ${transitionMs}ms ${easing}`,
          pointerEvents: 'none',
        }}
      />
      {/* Subtle stadium-light gradient at top */}
      <div aria-hidden style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 300, background: 'linear-gradient(180deg, rgba(255,255,255,0.04), transparent)', pointerEvents: 'none' }} />
      {/* Ghost text layer */}
      {tweaks.ghostText && <GhostText meta={meta} variant={variant} scale={tweaks.ghostScale} transitionMs={transitionMs} easing={easing} />}

      <Nav variant={variant} />

      {isMobile ? (
        <MobileHeroBody headline={headline} meta={meta} active={active} setActive={setActive} transitionMs={transitionMs} easing={easing} tweaks={tweaks} />
      ) : (
        <DesktopHeroBody headline={headline} meta={meta} active={active} setActive={setActive} transitionMs={transitionMs} easing={easing} tweaks={tweaks} />
      )}
    </section>
  );
}

function Nav({ variant }) {
  const isMobile = variant === 'mobile';
  return (
    <nav style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      paddingBottom: isMobile ? 24 : 40,
      zIndex: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <ArenaLogo size={isMobile ? 26 : 32} />
        <div style={{
          fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)',
          fontWeight: 900, fontSize: isMobile ? 18 : 22, letterSpacing: '0.08em',
        }}>ACTION ARENA</div>
      </div>
      {isMobile ? (
        <button style={{
          padding: '8px 14px',
          background: '#00FF87',
          color: '#0A0E1A',
          fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)',
          fontWeight: 900, fontSize: 13, letterSpacing: '0.06em',
          borderRadius: 999, border: 'none',
        }}>GET THE APP</button>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          {['Leagues', 'How it works', 'Locker', 'Compliance'].map((l) => (
            <a key={l} style={{
              fontSize: 14, color: 'rgba(255,255,255,0.7)', textDecoration: 'none', fontWeight: 500,
              letterSpacing: '0.01em',
            }}>{l}</a>
          ))}
          <button style={{
            padding: '10px 18px',
            background: '#00FF87',
            color: '#0A0E1A',
            fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)',
            fontWeight: 900, fontSize: 13, letterSpacing: '0.08em',
            borderRadius: 999, border: 'none',
            boxShadow: '0 6px 24px rgba(0,255,135,0.25)',
          }}>GET THE APP</button>
        </div>
      )}
    </nav>
  );
}

function ArenaLogo({ size = 32 }) {
  return (
    <div style={{
      width: size, height: size,
      background: 'linear-gradient(135deg, #00FF87, #18DCFF)',
      borderRadius: 8,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#0A0E1A',
      fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)',
      fontWeight: 900, fontSize: size * 0.6, letterSpacing: '-0.04em',
      lineHeight: 1, boxShadow: '0 4px 16px rgba(0,255,135,0.35)',
    }}>A</div>
  );
}

// ────────────────────────────────────────────────────────────────
// Ghost text — large condensed-display backdrop word
// ────────────────────────────────────────────────────────────────
function GhostText({ meta, variant, scale = 1, transitionMs, easing }) {
  const isMobile = variant === 'mobile';
  const min = (isMobile ? 60 : 90) * scale;
  const vw  = (isMobile ? 32 : 28) * scale;
  const max = (isMobile ? 220 : 380) * scale;
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        top: isMobile ? '14%' : '18%',
        left: 0, right: 0,
        textAlign: 'center',
        fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)',
        fontWeight: 900,
        fontSize: `clamp(${min}px, ${vw}vw, ${max}px)`,
        lineHeight: 0.85,
        letterSpacing: '-0.02em',
        color: '#FFFFFF',
        opacity: 0.05,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        transition: `opacity ${transitionMs}ms ${easing}`,
        zIndex: 1,
      }}
    >
      {meta.ghost}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Carousel stage: 3-role choreography (center / left / right) + state tabs
// ────────────────────────────────────────────────────────────────
function CarouselStage({ active, setActive, transitionMs, easing, tweaks }) {
  // 3 roles: previous (left, faded/scaled-down), active (center), next (right)
  const activeIdx = STATES.indexOf(active);
  return (
    <div style={{
      position: 'relative',
      height: 540,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 3,
    }}>
      {STATES.map((s, i) => {
        const offset = ((i - activeIdx) % 4 + 4) % 4; // 0 = active, 1 = next, 2 = far, 3 = prev
        const role =
          offset === 0 ? 'center' :
          offset === 1 ? 'right'  :
          offset === 3 ? 'left'   : 'hidden';
        const transform =
          role === 'center' ? 'translateX(0) scale(1)' :
          role === 'right'  ? 'translateX(110%) scale(0.75) rotateY(-12deg)' :
          role === 'left'   ? 'translateX(-110%) scale(0.75) rotateY(12deg)' :
                              'translateX(0) scale(0.6)';
        const opacity = role === 'center' ? 1 : role === 'hidden' ? 0 : 0.4;
        const filter  = role === 'center' ? 'blur(0)' : 'blur(2px)';
        const z = role === 'center' ? 3 : 1;
        const Card = STATE_META[s].Card;
        return (
          <div
            key={s}
            style={{
              position: 'absolute',
              transform,
              opacity,
              filter,
              zIndex: z,
              transition: `transform ${transitionMs}ms ${easing}, opacity ${transitionMs}ms ${easing}, filter ${transitionMs}ms ${easing}`,
              transformOrigin: 'center center',
              perspective: 800,
              pointerEvents: role === 'center' ? 'auto' : 'none',
            }}
            onClick={() => role !== 'center' && setActive(i, true)}
          >
            <Card />
          </div>
        );
      })}
    </div>
  );
}

function StateTabs({ active, setActive, accent, transitionMs, easing }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'center', gap: 4,
      padding: '6px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 999,
      width: 'fit-content',
      margin: '0 auto',
      position: 'relative',
      zIndex: 3,
    }}>
      {STATES.map((s, i) => {
        const on = s === active;
        const meta = STATE_META[s];
        return (
          <button
            key={s}
            onClick={() => setActive(i, true)}
            style={{
              padding: '8px 16px',
              border: 'none', cursor: 'pointer',
              background: on ? meta.accent : 'transparent',
              color: on ? '#0A0E1A' : 'rgba(255,255,255,0.65)',
              fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)',
              fontWeight: 900, fontSize: 13, letterSpacing: '0.08em',
              borderRadius: 999,
              transition: `background ${transitionMs}ms ${easing}, color ${transitionMs}ms ${easing}`,
              lineHeight: 1,
            }}
          >{meta.label}</button>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
function DesktopHeroBody({ headline, meta, active, setActive, transitionMs, easing, tweaks }) {
  return (
    <div style={{
      position: 'relative', zIndex: 2,
      display: 'grid', gridTemplateColumns: '1.05fr 1fr', gap: 60,
      alignItems: 'center',
      minHeight: 700,
    }}>
      {/* Left column — copy + CTA */}
      <div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 12px',
          background: `hsla(${meta.tint} / 0.14)`,
          border: `1px solid hsla(${meta.tint} / 0.4)`,
          borderRadius: 999,
          fontFamily: 'ui-monospace, monospace',
          fontSize: 11, letterSpacing: '0.12em',
          color: meta.accent,
          fontWeight: 600,
          marginBottom: 28,
          transition: `background ${transitionMs}ms ${easing}, border-color ${transitionMs}ms ${easing}, color ${transitionMs}ms ${easing}`,
        }}>
          <span style={{ width: 6, height: 6, background: meta.accent, borderRadius: 4, boxShadow: `0 0 10px ${meta.accent}` }} />
          {headline.eyebrow.toUpperCase()}
        </div>
        <h1 style={{
          fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)',
          fontWeight: 900, fontSize: 'clamp(64px, 7vw, 104px)',
          letterSpacing: '-0.02em', lineHeight: 0.92,
          margin: 0, marginBottom: 24,
        }}>
          {headline.big.map((line, i) => (
            <span key={i} style={{ display: 'block' }}>{line}</span>
          ))}
        </h1>
        <p style={{
          fontSize: 18, lineHeight: 1.55,
          color: 'rgba(255,255,255,0.72)',
          maxWidth: 480,
          margin: '0 0 36px',
        }}>{headline.deck}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 36 }}>
          <button style={{
            padding: '16px 28px',
            background: '#00FF87',
            color: '#0A0E1A',
            fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)',
            fontWeight: 900, fontSize: 17, letterSpacing: '0.08em',
            borderRadius: 12, border: 'none',
            boxShadow: '0 12px 32px rgba(0,255,135,0.35)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <AppleIcon /> DOWNLOAD ON THE APP STORE
          </button>
          <button style={{
            padding: '16px 24px',
            background: 'transparent',
            color: '#F8FAFC',
            fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)',
            fontWeight: 900, fontSize: 17, letterSpacing: '0.08em',
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.18)',
          }}>SEE HOW IT WORKS</button>
        </div>
        <KeyStats />
      </div>

      {/* Right column — carousel + tabs */}
      <div>
        <CarouselStage active={active} setActive={setActive} transitionMs={transitionMs} easing={easing} tweaks={tweaks} />
        <div style={{ marginTop: 24 }}>
          <StateTabs active={active} setActive={setActive} accent={meta.accent} transitionMs={transitionMs} easing={easing} />
        </div>
        <div style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.04em' }}>
          Four pick types · One weekly budget · One Lock per week
        </div>
      </div>
    </div>
  );
}

function MobileHeroBody({ headline, meta, active, setActive, transitionMs, easing, tweaks }) {
  return (
    <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 6,
        padding: '5px 10px',
        background: `hsla(${meta.tint} / 0.14)`,
        border: `1px solid hsla(${meta.tint} / 0.4)`,
        borderRadius: 999,
        fontFamily: 'ui-monospace, monospace',
        fontSize: 10, letterSpacing: '0.1em',
        color: meta.accent, fontWeight: 600,
        transition: `background ${transitionMs}ms ${easing}, border-color ${transitionMs}ms ${easing}, color ${transitionMs}ms ${easing}`,
      }}>
        <span style={{ width: 5, height: 5, background: meta.accent, borderRadius: 4 }} />
        {headline.eyebrow.toUpperCase()}
      </div>
      <h1 style={{
        fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)',
        fontWeight: 900, fontSize: 56, letterSpacing: '-0.02em', lineHeight: 0.9,
        margin: 0,
      }}>
        {headline.big.map((line, i) => <span key={i} style={{ display: 'block' }}>{line}</span>)}
      </h1>
      <p style={{ fontSize: 15, lineHeight: 1.5, color: 'rgba(255,255,255,0.72)', margin: 0 }}>{headline.deck}</p>

      <div style={{ marginTop: 10, marginLeft: -20, marginRight: -20, transform: 'scale(0.92)' }}>
        <CarouselStage active={active} setActive={setActive} transitionMs={transitionMs} easing={easing} tweaks={tweaks} />
      </div>
      <StateTabs active={active} setActive={setActive} accent={meta.accent} transitionMs={transitionMs} easing={easing} />

      <button style={{
        padding: '16px 24px',
        background: '#00FF87',
        color: '#0A0E1A',
        fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)',
        fontWeight: 900, fontSize: 16, letterSpacing: '0.08em',
        borderRadius: 12, border: 'none',
        marginTop: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        boxShadow: '0 10px 28px rgba(0,255,135,0.3)',
      }}>
        <AppleIcon /> DOWNLOAD ON THE APP STORE
      </button>
      <KeyStats compact />
    </div>
  );
}

function KeyStats({ compact }) {
  const items = [
    { v: '$100', l: 'weekly virtual budget' },
    { v: '18',   l: 'weeks of competition' },
    { v: '1.5×', l: 'Lock of the Week boost' },
  ];
  return (
    <div style={{
      display: 'flex',
      gap: compact ? 16 : 32,
      paddingTop: compact ? 12 : 24,
      borderTop: '1px solid rgba(255,255,255,0.08)',
      marginTop: compact ? 12 : 0,
    }}>
      {items.map((it, i) => (
        <div key={i} style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)',
            fontWeight: 900, fontSize: compact ? 24 : 36, letterSpacing: '0.01em',
            lineHeight: 1, marginBottom: 4,
            color: '#F8FAFC',
          }}>{it.v}</div>
          <div style={{ fontSize: compact ? 10 : 12, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em', lineHeight: 1.3 }}>{it.l}</div>
        </div>
      ))}
    </div>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 12.04c-.03-3.1 2.53-4.59 2.65-4.67-1.45-2.12-3.71-2.41-4.5-2.44-1.91-.2-3.74 1.13-4.71 1.13-.99 0-2.48-1.11-4.08-1.08-2.1.03-4.04 1.22-5.12 3.09-2.19 3.79-.56 9.38 1.57 12.45 1.04 1.5 2.27 3.18 3.87 3.12 1.56-.06 2.15-1 4.03-1 1.88 0 2.41 1 4.06.97 1.68-.03 2.74-1.52 3.76-3.03 1.19-1.74 1.67-3.43 1.7-3.51-.04-.02-3.26-1.25-3.29-4.97zM14.04 3.36C14.91 2.32 15.49.86 15.33-.6c-1.27.05-2.81.84-3.71 1.88-.81.92-1.52 2.4-1.33 3.84 1.41.11 2.85-.72 3.75-1.76z"/>
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────
// How it works — 3-step strip below the fold
// (Step 3 hosts the WinCelebration payoff)
// ────────────────────────────────────────────────────────────────
function HowItWorks({ variant }) {
  const isMobile = variant === 'mobile';
  return (
    <section
      data-screen-label="02 How it works"
      style={{
        background: '#111827',
        color: '#F8FAFC',
        padding: isMobile ? '56px 20px' : '96px 56px',
        position: 'relative',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ marginBottom: isMobile ? 32 : 56, maxWidth: 640 }}>
          <div style={{
            display: 'inline-block',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 11, letterSpacing: '0.16em',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: 14,
          }}>003 — HOW IT RUNS</div>
          <h2 style={{
            fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)',
            fontWeight: 900, fontSize: isMobile ? 44 : 72, letterSpacing: '-0.015em', lineHeight: 0.92,
            margin: 0,
          }}>Three taps to a season-long argument with your friends.</h2>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: isMobile ? 16 : 24,
        }}>
          <StepCard
            num="01"
            title="Start a league"
            body="Send a private invite to your group chat. Up to 12 friends, head-to-head matchups or cumulative-profit format."
            accent="#00FF87"
            visual={<LeagueVisual />}
          />
          <StepCard
            num="02"
            title="Spend your $100"
            body="Browse the week's slate, build straight picks, parlays, and teasers. Designate exactly one Lock for a 1.5× boost."
            accent="#FFA502"
            visual={<LineupVisual />}
          />
          <StepCard
            num="03"
            title="Beat your friends"
            body="Games settle live. The week's biggest profit climbs the standings. Sixteen weeks of bragging rights on the line."
            accent="#FFD700"
            visual={<CelebrationVisual />}
          />
        </div>
      </div>
    </section>
  );
}

function StepCard({ num, title, body, accent, visual }) {
  return (
    <div style={{
      background: '#0A0E1A',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 24,
      padding: 24,
      display: 'flex', flexDirection: 'column', gap: 20,
      overflow: 'hidden',
      position: 'relative',
    }}>
      <div style={{ height: 200, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 16, background: `radial-gradient(ellipse at center, ${accent}14, transparent 70%)` }}>
        {visual}
      </div>
      <div>
        <div style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: 11, letterSpacing: '0.16em',
          color: accent, marginBottom: 8, fontWeight: 600,
        }}>STEP {num}</div>
        <h3 style={{
          fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)',
          fontWeight: 900, fontSize: 30, letterSpacing: '-0.005em',
          margin: '0 0 12px',
        }}>{title}</h3>
        <p style={{
          fontSize: 15, lineHeight: 1.55,
          color: 'rgba(255,255,255,0.65)',
          margin: 0,
        }}>{body}</p>
      </div>
    </div>
  );
}

function LeagueVisual() {
  const members = [
    { code: 'KC',  name: 'Marcus',   record: '7-2', profit: '+142', you: true },
    { code: 'BUF', name: 'Priya',    record: '6-3', profit: '+98'  },
    { code: 'PHI', name: 'Tyler',    record: '5-4', profit: '+24'  },
    { code: 'SF',  name: 'Jordan',   record: '4-5', profit: '-12'  },
  ];
  return (
    <div style={{
      width: 260, background: '#111827',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, padding: 12,
      boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
    }}>
      <div style={{
        fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)',
        fontWeight: 900, fontSize: 13, letterSpacing: '0.08em',
        color: '#00FF87', marginBottom: 8,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        SUNDAY CREW · WK 9
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontFamily: 'ui-monospace, monospace' }}>4/12</span>
      </div>
      {members.map((m) => (
        <div key={m.code} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '7px 0',
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}>
          <TeamCrest code={m.code} size={22} />
          <div style={{ flex: 1, fontSize: 12, fontWeight: 500 }}>
            {m.name}
            {m.you && <span style={{ marginLeft: 6, fontSize: 9, padding: '1px 5px', background: '#00FF87', color: '#0A0E1A', borderRadius: 3, fontWeight: 700, letterSpacing: '0.05em' }}>YOU</span>}
          </div>
          <div style={{ fontSize: 11, fontFamily: 'ui-monospace, monospace', color: 'rgba(255,255,255,0.5)' }}>{m.record}</div>
          <div style={{
            fontSize: 12, fontFamily: 'ui-monospace, monospace', fontWeight: 600,
            color: m.profit.startsWith('+') ? '#00FF87' : '#FF4757',
            width: 40, textAlign: 'right',
          }}>{m.profit}</div>
        </div>
      ))}
    </div>
  );
}

function LineupVisual() {
  return (
    <div style={{
      width: 260,
      background: '#111827',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14, padding: 12,
      boxShadow: '0 16px 40px rgba(0,0,0,0.3)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{
          fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)',
          fontWeight: 900, fontSize: 13, letterSpacing: '0.08em', color: '#FFA502',
        }}>YOUR LINEUP · WK 9</div>
        <div style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace', color: 'rgba(255,255,255,0.55)' }}>$78 / $100</div>
      </div>
      <div style={{
        height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', marginBottom: 12,
      }}>
        <div style={{ width: '78%', height: '100%', background: 'linear-gradient(90deg, #00FF87, #FFA502)' }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { type: 'STRAIGHT', text: 'KC −3.5',   stake: 25, profit: 23, accent: '#00FF87', locked: true },
          { type: 'PARLAY',   text: '3-leg',     stake: 20, profit: 148, accent: '#FFA502' },
          { type: 'TEASER',   text: '2-team +6', stake: 20, profit: 36,  accent: '#18DCFF' },
          { type: 'LOCK',     text: 'KC −3.5',   stake: 13, profit: 18,  accent: '#FFD700', lockBoost: true },
        ].map((row, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 9px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 8,
            borderLeft: `2px solid ${row.accent}`,
          }}>
            <div style={{
              fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)',
              fontWeight: 900, fontSize: 9, letterSpacing: '0.08em',
              color: row.accent, width: 56,
            }}>{row.type}</div>
            <div style={{ flex: 1, fontSize: 11, fontWeight: 500 }}>{row.text}
              {row.lockBoost && <span style={{ marginLeft: 4, fontSize: 8, color: '#FFD700', fontFamily: 'ui-monospace, monospace' }}>1.5×</span>}
            </div>
            <div style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace', color: '#00FF87' }}>+{row.profit}c</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Mini WinCelebration — distilled, no full-screen
function CelebrationVisual() {
  return (
    <div style={{ position: 'relative', width: 260, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Radial sparkle bursts */}
      <svg width="260" height="180" style={{ position: 'absolute', inset: 0 }} aria-hidden>
        {Array.from({ length: 14 }).map((_, i) => {
          const angle = (i / 14) * Math.PI * 2;
          const r1 = 50, r2 = 80;
          const x1 = 130 + Math.cos(angle) * r1;
          const y1 = 90 + Math.sin(angle) * r1;
          const x2 = 130 + Math.cos(angle) * r2;
          const y2 = 90 + Math.sin(angle) * r2;
          const c = ['#00FF87', '#FFD700', '#FFA502', '#18DCFF'][i % 4];
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c} strokeWidth="2.5" strokeLinecap="round" opacity="0.85" />;
        })}
        {Array.from({ length: 18 }).map((_, i) => {
          const a = Math.random() * Math.PI * 2;
          const r = 30 + Math.random() * 65;
          const cx = 130 + Math.cos(a) * r;
          const cy = 90 + Math.sin(a) * r;
          const c = ['#00FF87', '#FFD700', '#48FFAB', '#FFD58A'][i % 4];
          return <circle key={i + 'd'} cx={cx} cy={cy} r="1.5" fill={c} opacity="0.85" />;
        })}
      </svg>
      <div style={{
        position: 'relative', zIndex: 2,
        textAlign: 'center',
      }}>
        <div style={{
          fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)',
          fontWeight: 900, fontSize: 64, letterSpacing: '-0.02em', lineHeight: 0.85,
          color: '#00FF87',
          textShadow: '0 0 32px rgba(0,255,135,0.6)',
        }}>+148</div>
        <div style={{
          fontFamily: 'ui-monospace, monospace', fontSize: 10,
          color: 'rgba(255,255,255,0.7)', letterSpacing: '0.12em',
          marginTop: 4,
        }}>PARLAY HIT · WEEK 9</div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
function Footer({ variant }) {
  const isMobile = variant === 'mobile';
  return (
    <footer style={{
      background: '#0A0E1A',
      color: 'rgba(255,255,255,0.45)',
      padding: isMobile ? '32px 20px' : '40px 56px',
      borderTop: '1px solid rgba(255,255,255,0.06)',
    }}>
      <div style={{
        maxWidth: 1280, margin: '0 auto',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 20 : 32,
        alignItems: isMobile ? 'flex-start' : 'flex-end',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <ArenaLogo size={22} />
            <div style={{ fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)', fontWeight: 900, fontSize: 16, letterSpacing: '0.08em', color: '#F8FAFC' }}>ACTION ARENA</div>
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.5, maxWidth: 480 }}>
            A fantasy sports prediction game. Build a weekly lineup against a virtual-coin budget and compete with friends. Virtual currency only — not a gambling product. Cosmetic items have no monetary value and cannot be redeemed for cash. NFL team names property of their respective owners.
          </div>
        </div>
        <div style={{
          display: 'flex', gap: 24,
          fontSize: 12,
          flexWrap: 'wrap',
        }}>
          <a style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>Privacy</a>
          <a style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>Terms</a>
          <a style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>Press kit</a>
          <a style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>Support</a>
        </div>
      </div>
    </footer>
  );
}

// ────────────────────────────────────────────────────────────────
// LandingPage — top-level export, used inside both artboards
// ────────────────────────────────────────────────────────────────
function LandingPage({ variant = 'desktop', tweaks, setTweak }) {
  // Apply display font via CSS variable scoped to this artboard.
  const fontStack =
    tweaks.displayFont === 'anton'    ? '"Anton", "Bebas Neue", "Impact", system-ui' :
    tweaks.displayFont === 'druk-sub' ? '"Oswald", "Anton", "Impact", system-ui' :
                                        '"Bebas Neue", "Anton", "Impact", system-ui';

  return (
    <div style={{ '--aa-display': fontStack, fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif' }}>
      <Hero tweaks={tweaks} setTweak={setTweak} variant={variant} />
      <HowItWorks variant={variant} />
      <Footer variant={variant} />
    </div>
  );
}

Object.assign(window, { LandingPage });
