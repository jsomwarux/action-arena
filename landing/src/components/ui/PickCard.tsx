// PickCard.tsx — the four hero pick-type cards (Straight, Parlay, Teaser,
// Lock) plus their shared chrome, ported from the prototype's pick-cards.jsx.
//
// Compliance (INTAKE/HANDOFF §9): copy uses picks, parlay, teaser, lineup,
// lock, virtual coins, profit. Never: bet, wager, sportsbook, odds, payout.
//
// Cards are visually static; all motion (position/scale/blur) is applied by
// the Carousel wrapper. Dynamic per-team / per-accent colors use inline
// styles; structure/spacing/type use Tailwind utilities.
import type { CSSProperties, ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { TEAMS, type TeamCode } from '../../lib/teams';

export type StateKey = 'straight' | 'parlay' | 'teaser' | 'lock';

export const STATES: StateKey[] = ['straight', 'parlay', 'teaser', 'lock'];

export interface StateMeta {
  /** Tab + accessible label. */
  label: string;
  /** Giant ghost-text word behind the hero. */
  ghost: string;
  /** Accent hex for tints, tabs, badge dot. */
  accent: string;
  /** HSL channel for the background radial tint (`H S% L%`). */
  tint: string;
}

export const STATE_META: Record<StateKey, StateMeta> = {
  straight: { label: 'STRAIGHT', ghost: 'STRAIGHT', accent: '#00FF87', tint: '152 100% 50%' },
  parlay: { label: 'PARLAY', ghost: 'PARLAY', accent: '#FFA502', tint: '39 100% 50%' },
  teaser: { label: 'TEASER', ghost: 'TEASER', accent: '#18DCFF', tint: '189 100% 55%' },
  lock: { label: 'LOCK', ghost: 'LOCK', accent: '#FFD700', tint: '51 100% 50%' },
};

// ── Team crest (placeholder monogram, no licensed logo) ───────────
export function TeamCrest({ code, size = 36 }: { code: TeamCode; size?: number }) {
  const t = TEAMS[code];
  return (
    <div
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-display font-black leading-none text-white"
      style={{
        width: size,
        height: size,
        background: t.primary,
        boxShadow: `inset 0 0 0 2px ${t.secondary}, 0 4px 12px ${t.primary}55`,
        fontSize: size * 0.42,
        letterSpacing: '0.02em',
      }}
    >
      {code}
    </div>
  );
}

// ── Shared chrome ─────────────────────────────────────────────────
function CardShell({
  children,
  glow,
  ring,
  ringWidth = 1,
  badge,
}: {
  children: ReactNode;
  glow: string;
  ring: string;
  ringWidth?: number;
  badge?: ReactNode;
}) {
  return (
    <div
      className="relative w-[320px] rounded-3xl bg-arena-surface p-5 text-textPrimary"
      style={{
        boxShadow: `0 0 0 ${ringWidth}px ${ring}, 0 24px 60px -12px ${glow}, 0 0 80px -10px ${glow}`,
      }}
    >
      {badge}
      {children}
    </div>
  );
}

function PickTypeBadge({
  label,
  color,
  bg,
  icon,
}: {
  label: string;
  color: string;
  bg: string;
  icon?: ReactNode;
}) {
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[5px] font-display text-xs font-black leading-none tracking-[0.08em]"
      style={{ background: bg, color }}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}

function CoinChip({ value, accent = '#FFD700' }: { value: number; accent?: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.06] py-1 pl-1.5 pr-2.5">
      <span
        className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-full font-mono text-[11px] font-black"
        style={{ background: `radial-gradient(circle at 30% 30%, ${accent}, ${accent}aa)`, color: '#29261b' }}
      >
        c
      </span>
      <span className="font-display text-base font-black tracking-[0.04em] text-textPrimary">{value}</span>
    </div>
  );
}

function LegRow({
  away,
  home,
  pick,
  line,
  profit,
  color = '#F8FAFC',
  locked = false,
  teased,
}: {
  away: TeamCode;
  home: TeamCode;
  pick: string;
  line: string;
  profit: number;
  color?: string;
  locked?: boolean;
  teased?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 border-t border-white/[0.07] py-2.5">
      <div className="flex">
        <TeamCrest code={away} size={28} />
        <div className="-ml-2.5">
          <TeamCrest code={home} size={28} />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-white/55">
          {away} <span className="opacity-50">@</span> {home}
        </div>
        <div
          className="flex items-baseline gap-1.5 font-display text-lg font-black leading-[1.1] tracking-[0.02em]"
          style={{ color }}
        >
          {pick}
          <span style={{ color, opacity: 0.85 }}>{line}</span>
          {teased && (
            <span className="rounded bg-cyan-accent/[0.12] px-1.5 py-px font-mono text-[9px] font-semibold tracking-[0.05em] text-cyan-accent">
              +{teased}
            </span>
          )}
        </div>
      </div>
      <div className="text-right">
        {locked ? (
          <Lock className="h-[18px] w-[18px] text-white/55" strokeWidth={2} aria-hidden />
        ) : (
          <div
            className="font-mono text-[13px] font-semibold tracking-[0.02em]"
            style={{ color: profit > 0 ? '#00FF87' : '#F8FAFC' }}
          >
            {profit > 0 ? '+' : ''}
            {profit}
            <span className="ml-0.5 text-[9px] opacity-70">c</span>
          </div>
        )}
      </div>
    </div>
  );
}

function FooterRow({
  stake,
  profit,
  label = 'PROFIT',
  accent = '#00FF87',
}: {
  stake: number;
  profit: number;
  label?: string;
  accent?: string;
}) {
  return (
    <div className="mt-4 flex items-center justify-between border-t border-dashed border-white/[0.12] pt-3.5">
      <div>
        <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/50">STAKE</div>
        <CoinChip value={stake} />
      </div>
      <div className="text-right">
        <div className="mb-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-white/50">{label}</div>
        <div
          className="font-display text-[28px] font-black leading-none tracking-[0.02em]"
          style={{ color: accent, textShadow: `0 0 24px ${accent}66` }}
        >
          +{profit}
          <span className="ml-[3px] text-sm opacity-75">c</span>
        </div>
      </div>
    </div>
  );
}

// ── STRAIGHT — single leg, electric-green ─────────────────────────
function StraightCard() {
  return (
    <CardShell glow="rgba(0,255,135,0.15)" ring="rgba(0,255,135,0.18)">
      <div className="mb-3.5 flex items-start justify-between">
        <PickTypeBadge label="STRAIGHT PICK" color="#0A0E1A" bg="#00FF87" />
        <div className="font-mono text-[10px] tracking-[0.08em] text-white/50">WEEK 12 · SUN 1:00 ET</div>
      </div>
      <div className="mb-1 flex items-center gap-3">
        <TeamCrest code="DEN" size={44} />
        <div className="flex-1 font-display text-[22px] font-black tracking-[0.02em] text-white/55">
          DENVER
          <div className="text-[11px] font-bold tracking-[0.1em] text-white/40">4-7 · AWAY</div>
        </div>
        <div className="font-mono text-[11px] tracking-[0.1em] text-white/40">@</div>
      </div>
      <div className="mx-[-4px] mt-2 flex items-center gap-3 rounded-xl border border-electric-green/[0.18] bg-electric-green/[0.05] px-3 py-2.5">
        <TeamCrest code="KC" size={44} />
        <div className="flex-1 font-display text-[22px] font-black tracking-[0.02em]">
          KANSAS CITY
          <div className="text-[11px] font-bold tracking-[0.1em] text-electric-green">9-2 · YOUR PICK</div>
        </div>
        <div
          className="font-display text-[28px] font-black tracking-[0.02em] text-electric-green"
          style={{ textShadow: '0 0 24px rgba(0,255,135,0.5)' }}
        >
          −3.5
        </div>
      </div>
      <FooterRow stake={25} profit={23} />
    </CardShell>
  );
}

// ── PARLAY — 3 legs, amber ────────────────────────────────────────
function ParlayCard() {
  return (
    <CardShell glow="rgba(255,165,2,0.22)" ring="rgba(255,165,2,0.28)">
      <div className="mb-3 flex items-start justify-between">
        <PickTypeBadge label="3-LEG PARLAY" color="#0A0E1A" bg="#FFA502" />
        <div className="font-mono text-[10px] tracking-[0.08em] text-white/50">ALL LEGS HIT · 8.4×</div>
      </div>
      <LegRow away="DEN" home="KC" pick="KC" line="−3.5" profit={21} color="#FFA502" />
      <LegRow away="BUF" home="MIA" pick="BUF" line="ML" profit={14} color="#FFA502" />
      <LegRow away="SF" home="DAL" pick="SF" line="−2" profit={19} color="#FFA502" />
      <FooterRow stake={20} profit={148} accent="#FFA502" label="PARLAY PROFIT" />
    </CardShell>
  );
}

// ── TEASER — 2 legs +6 boost, cyan ───────────────────────────────
function TeaserCard() {
  return (
    <CardShell glow="rgba(24,220,255,0.22)" ring="rgba(24,220,255,0.28)">
      <div className="mb-3 flex items-start justify-between">
        <PickTypeBadge label="2-TEAM TEASER" color="#0A0E1A" bg="#18DCFF" />
        <div className="font-mono text-[10px] font-bold tracking-[0.08em] text-cyan-accent">+6 POINTS EACH</div>
      </div>
      <div className="px-0 pb-2.5 pt-1 text-[11px] leading-[1.5] text-white/55">
        Shift two spreads in your favor. Both must hit. Lower profit, friendlier lines.
      </div>
      <LegRow away="DEN" home="KC" pick="KC" line="+2.5" teased="6" profit={0} color="#18DCFF" />
      <LegRow away="SF" home="DAL" pick="SF" line="+8" teased="6" profit={0} color="#18DCFF" />
      <FooterRow stake={20} profit={36} accent="#18DCFF" label="TEASER PROFIT" />
    </CardShell>
  );
}

// ── LOCK — Lock of the Week, gold, 1.5× ──────────────────────────
function LockCard() {
  const padlockBadge = (
    <div
      className="absolute right-[18px] top-[-14px] flex items-center gap-1.5 rounded-lg px-2.5 py-[5px] font-display text-[11px] font-black tracking-[0.1em] text-[#29261b]"
      style={{
        background: 'linear-gradient(135deg, #FFD700, #FFA502)',
        boxShadow: '0 6px 18px rgba(255,215,0,0.45), inset 0 1px 0 rgba(255,255,255,0.4)',
      }}
    >
      <Lock className="h-[11px] w-[11px]" strokeWidth={3} aria-hidden />
      1 LOCK PER WEEK
    </div>
  );
  return (
    <CardShell glow="rgba(255,215,0,0.35)" ring="rgba(255,215,0,0.55)" ringWidth={2} badge={padlockBadge}>
      <div className="mb-3 mt-1 flex items-start justify-between">
        <PickTypeBadge
          label="LOCK OF THE WEEK"
          color="#29261b"
          bg="#FFD700"
          icon={<Lock className="h-2.5 w-2.5" strokeWidth={3.5} aria-hidden />}
        />
        <div
          className="font-display text-[22px] font-black leading-none tracking-[0.02em] text-gold"
          style={{ textShadow: '0 0 20px rgba(255,215,0,0.6)' }}
        >
          1.5×
        </div>
      </div>
      <div
        className="mx-[-4px] mt-1 flex items-center gap-3 rounded-xl border border-gold/[0.32] p-3"
        style={{ background: 'linear-gradient(180deg, rgba(255,215,0,0.08), rgba(255,215,0,0.02))' }}
      >
        <TeamCrest code="KC" size={48} />
        <div className="flex-1 font-display text-2xl font-black tracking-[0.02em]">
          KANSAS CITY
          <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.1em] text-gold">
            <span>YOUR LOCK</span>
            <span className="h-1 w-1 rounded-sm bg-gold" />
            <span>9-2</span>
          </div>
        </div>
        <div
          className="font-display text-[30px] font-black tracking-[0.02em] text-gold"
          style={{ textShadow: '0 0 24px rgba(255,215,0,0.7)' }}
        >
          −3.5
        </div>
      </div>
      <div className="mt-3 flex items-center justify-center gap-2 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-gold/85">
        <span className="h-px flex-1" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.4))' }} />
        Designate one Lock. Boost the profit. No do-overs.
        <span className="h-px flex-1" style={{ background: 'linear-gradient(90deg, rgba(255,215,0,0.4), transparent)' }} />
      </div>
      <FooterRow stake={30} profit={41} accent="#FFD700" label="LOCK PROFIT · 1.5×" />
    </CardShell>
  );
}

const CARD_BY_STATE: Record<StateKey, () => ReactNode> = {
  straight: StraightCard,
  parlay: ParlayCard,
  teaser: TeaserCard,
  lock: LockCard,
};

/** Render the pick card for a given carousel state. */
export function PickCard({ state, style }: { state: StateKey; style?: CSSProperties }) {
  const Card = CARD_BY_STATE[state];
  return <div style={style}>{Card()}</div>;
}
