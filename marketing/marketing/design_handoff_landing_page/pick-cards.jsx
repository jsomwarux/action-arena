// pick-cards.jsx — Pick-card mocks for the Action Arena hero carousel.
// Four cards: Straight / Parlay / Teaser / Lock. Each is a self-contained
// React component that renders at any width via internal flex/grid.
//
// Compliance: terms used = picks, parlay, teaser, lineup, lock, virtual
// coins, profit. Avoided = bet, wager, sportsbook, odds, payout, cash out.

// ──────────────────────────────────────────────────────────────
// NFL team palette (placeholder crests — no logos).
// 2-tone per team: primary bg / secondary ring + monogram glyph.
// ──────────────────────────────────────────────────────────────
const TEAMS = {
  KC:  { name: 'CHIEFS',    city: 'KANSAS CITY',   primary: '#E31837', secondary: '#FFB81C' },
  DEN: { name: 'BRONCOS',   city: 'DENVER',        primary: '#FB4F14', secondary: '#002244' },
  BUF: { name: 'BILLS',     city: 'BUFFALO',       primary: '#00338D', secondary: '#C60C30' },
  MIA: { name: 'DOLPHINS',  city: 'MIAMI',         primary: '#008E97', secondary: '#FC4C02' },
  SF:  { name: '49ERS',     city: 'SAN FRANCISCO', primary: '#AA0000', secondary: '#B3995D' },
  DAL: { name: 'COWBOYS',   city: 'DALLAS',        primary: '#003594', secondary: '#869397' },
  PHI: { name: 'EAGLES',    city: 'PHILADELPHIA',  primary: '#004C54', secondary: '#A5ACAF' },
  GB:  { name: 'PACKERS',   city: 'GREEN BAY',     primary: '#203731', secondary: '#FFB612' },
  BAL: { name: 'RAVENS',    city: 'BALTIMORE',     primary: '#241773', secondary: '#9E7C0C' },
  DET: { name: 'LIONS',     city: 'DETROIT',       primary: '#0076B6', secondary: '#B0B7BC' },
};

function TeamCrest({ code, size = 36 }) {
  const t = TEAMS[code];
  if (!t) return null;
  return (
    <div
      style={{
        width: size, height: size, flexShrink: 0,
        borderRadius: '50%',
        background: t.primary,
        boxShadow: `inset 0 0 0 2px ${t.secondary}, 0 4px 12px ${t.primary}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff',
        fontFamily: 'var(--aa-display, "Bebas Neue", "Anton", system-ui)',
        fontWeight: 900,
        fontSize: size * 0.42,
        letterSpacing: '0.02em',
        lineHeight: 1,
      }}
    >
      {code}
    </div>
  );
}

// Shared chrome ─────────────────────────────────────────────────
function CardShell({ children, accent, glow, ring, badge, scale = 1 }) {
  return (
    <div
      style={{
        position: 'relative',
        width: 320 * scale,
        background: '#111827',
        borderRadius: 24,
        padding: 20 * scale,
        boxShadow: `0 0 0 ${ring ? 2 : 1}px ${ring || 'rgba(255,255,255,0.08)'}, 0 24px 60px -12px ${glow || 'rgba(0,0,0,0.6)'}, 0 0 80px -10px ${glow || 'transparent'}`,
        color: '#F8FAFC',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, "SF Pro Text", sans-serif',
      }}
    >
      {badge}
      {children}
    </div>
  );
}

function PickTypeBadge({ label, color, bg, icon }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '5px 10px',
      background: bg,
      color, fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)',
      fontWeight: 900, fontSize: 12, letterSpacing: '0.08em',
      borderRadius: 999,
      lineHeight: 1,
    }}>
      {icon}
      <span>{label}</span>
    </div>
  );
}

function LegRow({ away, home, pick, line, profit, color = '#F8FAFC', dim = false, locked = false, teased }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 0',
      borderTop: '1px solid rgba(255,255,255,0.07)',
      opacity: dim ? 0.55 : 1,
    }}>
      <div style={{ display: 'flex', gap: -8 }}>
        <TeamCrest code={away} size={28} />
        <div style={{ marginLeft: -10 }}><TeamCrest code={home} size={28} /></div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
          {away} <span style={{ opacity: 0.5 }}>@</span> {home}
        </div>
        <div style={{ fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)', fontWeight: 900, fontSize: 18, letterSpacing: '0.02em', lineHeight: 1.1, color, display: 'flex', alignItems: 'baseline', gap: 6 }}>
          {pick}
          <span style={{ color: color, opacity: 0.85 }}>{line}</span>
          {teased && (
            <span style={{
              fontSize: 9, fontFamily: 'ui-monospace, "SF Mono", monospace',
              color: '#18DCFF', background: 'rgba(24,220,255,0.12)',
              padding: '1px 5px', borderRadius: 4,
              letterSpacing: '0.05em', fontWeight: 600,
            }}>+{teased}</span>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        {locked ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="2">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 1 1 8 0v4" />
          </svg>
        ) : (
          <div style={{
            fontFamily: 'ui-monospace, "SF Mono", monospace',
            fontSize: 13, fontWeight: 600,
            color: profit > 0 ? '#00FF87' : '#F8FAFC',
            letterSpacing: '0.02em',
          }}>
            {profit > 0 ? '+' : ''}{profit}<span style={{ fontSize: 9, marginLeft: 2, opacity: 0.7 }}>c</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CoinChip({ value, accent = '#FFD700' }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px 4px 6px',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 999,
    }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 18, height: 18, borderRadius: '50%',
        background: `radial-gradient(circle at 30% 30%, ${accent}, ${accent}aa)`,
        color: '#29261b', fontWeight: 900, fontSize: 11,
        fontFamily: 'ui-monospace, monospace',
      }}>c</span>
      <span style={{
        fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)',
        fontWeight: 900, fontSize: 16, letterSpacing: '0.04em',
        color: '#F8FAFC',
      }}>{value}</span>
    </div>
  );
}

function FooterRow({ stake, profit, label = 'PROFIT', accent = '#00FF87' }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginTop: 16, paddingTop: 14,
      borderTop: '1px dashed rgba(255,255,255,0.12)',
    }}>
      <div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>STAKE</div>
        <CoinChip value={stake} />
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>{label}</div>
        <div style={{
          fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)',
          fontWeight: 900, fontSize: 28, letterSpacing: '0.02em',
          color: accent, lineHeight: 1,
          textShadow: `0 0 24px ${accent}66`,
        }}>+{profit}<span style={{ fontSize: 14, marginLeft: 3, opacity: 0.75 }}>c</span></div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// STRAIGHT pick — single leg
// ──────────────────────────────────────────────────────────────
function StraightCard({ scale = 1 }) {
  return (
    <CardShell scale={scale} glow="rgba(0,255,135,0.15)" ring="rgba(0,255,135,0.18)">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <PickTypeBadge label="STRAIGHT PICK" color="#0A0E1A" bg="#00FF87" />
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.08em' }}>WEEK 12 · SUN 1:00 ET</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <TeamCrest code="DEN" size={44} />
        <div style={{ flex: 1, fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)', fontWeight: 900, fontSize: 22, letterSpacing: '0.02em', color: 'rgba(255,255,255,0.55)' }}>
          DENVER
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', fontWeight: 700 }}>4-7 · AWAY</div>
        </div>
        <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>@</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', margin: '8px -4px 0', background: 'rgba(0,255,135,0.05)', borderRadius: 12, border: '1px solid rgba(0,255,135,0.18)' }}>
        <TeamCrest code="KC" size={44} />
        <div style={{ flex: 1, fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)', fontWeight: 900, fontSize: 22, letterSpacing: '0.02em' }}>
          KANSAS CITY
          <div style={{ fontSize: 11, color: '#00FF87', letterSpacing: '0.1em', fontWeight: 700 }}>9-2 · YOUR PICK</div>
        </div>
        <div style={{
          fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)',
          fontWeight: 900, fontSize: 28, letterSpacing: '0.02em', color: '#00FF87',
          textShadow: '0 0 24px rgba(0,255,135,0.5)',
        }}>−3.5</div>
      </div>
      <FooterRow stake={25} profit={23} />
    </CardShell>
  );
}

// ──────────────────────────────────────────────────────────────
// PARLAY — 3 legs, amber accent
// ──────────────────────────────────────────────────────────────
function ParlayCard({ scale = 1 }) {
  return (
    <CardShell scale={scale} glow="rgba(255,165,2,0.22)" ring="rgba(255,165,2,0.28)">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <PickTypeBadge label="3-LEG PARLAY" color="#0A0E1A" bg="#FFA502" />
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.08em' }}>ALL LEGS HIT · 8.4×</div>
      </div>
      <LegRow away="DEN" home="KC"  pick="KC"  line="−3.5" profit={21} color="#FFA502" />
      <LegRow away="BUF" home="MIA" pick="BUF" line="ML"   profit={14} color="#FFA502" />
      <LegRow away="SF"  home="DAL" pick="SF"  line="−2"   profit={19} color="#FFA502" />
      <FooterRow stake={20} profit={148} accent="#FFA502" label="PARLAY PROFIT" />
    </CardShell>
  );
}

// ──────────────────────────────────────────────────────────────
// TEASER — 2 legs with +6 point boost, cyan accent
// ──────────────────────────────────────────────────────────────
function TeaserCard({ scale = 1 }) {
  return (
    <CardShell scale={scale} glow="rgba(24,220,255,0.22)" ring="rgba(24,220,255,0.28)">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <PickTypeBadge label="2-TEAM TEASER" color="#0A0E1A" bg="#18DCFF" />
        <div style={{ fontSize: 10, color: '#18DCFF', fontFamily: 'ui-monospace, monospace', letterSpacing: '0.08em', fontWeight: 700 }}>+6 POINTS EACH</div>
      </div>
      <div style={{ padding: '4px 0 10px', fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
        Shift two spreads in your favor. Both must hit. Lower profit, friendlier lines.
      </div>
      <LegRow away="DEN" home="KC" pick="KC" line="+2.5" teased="6" profit={0} color="#18DCFF" />
      <LegRow away="SF" home="DAL" pick="SF" line="+8"   teased="6" profit={0} color="#18DCFF" />
      <FooterRow stake={20} profit={36} accent="#18DCFF" label="TEASER PROFIT" />
    </CardShell>
  );
}

// ──────────────────────────────────────────────────────────────
// LOCK — Lock of the Week, gold accent, 1.5× multiplier
// ──────────────────────────────────────────────────────────────
function LockCard({ scale = 1 }) {
  return (
    <CardShell
      scale={scale}
      glow="rgba(255,215,0,0.35)"
      ring="rgba(255,215,0,0.55)"
      badge={(
        <div style={{
          position: 'absolute', top: -14, right: 18,
          background: 'linear-gradient(135deg, #FFD700, #FFA502)',
          color: '#29261b',
          padding: '5px 10px 5px 8px',
          borderRadius: 8,
          fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)',
          fontWeight: 900, fontSize: 11, letterSpacing: '0.1em',
          display: 'flex', alignItems: 'center', gap: 5,
          boxShadow: '0 6px 18px rgba(255,215,0,0.45), inset 0 1px 0 rgba(255,255,255,0.4)',
        }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 1 1 8 0v4" />
          </svg>
          1 LOCK PER WEEK
        </div>
      )}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, marginTop: 4 }}>
        <PickTypeBadge label="LOCK OF THE WEEK" color="#29261b" bg="#FFD700" icon={
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 1 1 8 0v4" />
          </svg>
        } />
        <div style={{
          fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)',
          fontWeight: 900, fontSize: 22, letterSpacing: '0.02em',
          color: '#FFD700', lineHeight: 1,
          textShadow: '0 0 20px rgba(255,215,0,0.6)',
        }}>1.5×</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px', margin: '4px -4px 0', background: 'linear-gradient(180deg, rgba(255,215,0,0.08), rgba(255,215,0,0.02))', borderRadius: 12, border: '1px solid rgba(255,215,0,0.32)' }}>
        <TeamCrest code="KC" size={48} />
        <div style={{ flex: 1, fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)', fontWeight: 900, fontSize: 24, letterSpacing: '0.02em' }}>
          KANSAS CITY
          <div style={{ fontSize: 11, color: '#FFD700', letterSpacing: '0.1em', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>YOUR LOCK</span>
            <span style={{ width: 4, height: 4, borderRadius: 2, background: '#FFD700' }} />
            <span>9-2</span>
          </div>
        </div>
        <div style={{
          fontFamily: 'var(--aa-display, "Bebas Neue", system-ui)',
          fontWeight: 900, fontSize: 30, letterSpacing: '0.02em', color: '#FFD700',
          textShadow: '0 0 24px rgba(255,215,0,0.7)',
        }}>−3.5</div>
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,215,0,0.85)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700, marginTop: 12, textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.4))' }} />
        Designate one Lock. Boost the payout. No do-overs.
        <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(255,215,0,0.4), transparent)' }} />
      </div>
      <FooterRow stake={30} profit={41} accent="#FFD700" label="LOCK PROFIT · 1.5×" />
    </CardShell>
  );
}

Object.assign(window, { StraightCard, ParlayCard, TeaserCard, LockCard, TEAMS, TeamCrest });
