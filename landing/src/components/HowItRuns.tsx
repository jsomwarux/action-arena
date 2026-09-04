// HowItRuns.tsx — "003 — HOW IT RUNS" three-step strip.
// Step 3 hosts the distilled WinCelebration payoff (per COMPONENTS.md, the
// celebration is the product's emotional reward). Card copy is verbatim from
// the Claude Design artifact. Mini standings/lineup/celebration mocks are
// decorative illustrations (aria-hidden); the heading + body carry meaning.
import { useMemo, type ReactNode } from 'react';
import { TeamCrest } from './ui/PickCard';
import type { TeamCode } from '../lib/teams';

function StepCard({
  num,
  title,
  body,
  accent,
  visual,
}: {
  num: string;
  title: string;
  body: string;
  accent: string;
  visual: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 overflow-hidden rounded-3xl border border-white/[0.06] bg-arena-bg p-6">
      <div
        className="relative flex h-[200px] items-center justify-center overflow-hidden rounded-2xl"
        style={{ background: `radial-gradient(ellipse at center, ${accent}14, transparent 70%)` }}
        aria-hidden
      >
        {visual}
      </div>
      <div>
        <div className="mb-2 font-mono text-[11px] font-semibold tracking-[0.16em]" style={{ color: accent }}>
          STEP {num}
        </div>
        <h3 className="mb-3 font-display text-[30px] font-black tracking-[-0.005em]">{title}</h3>
        <p className="text-[15px] leading-[1.55] text-white/65">{body}</p>
      </div>
    </div>
  );
}

interface Member {
  code: TeamCode;
  name: string;
  record: string;
  profit: string;
  you?: boolean;
}

function LeagueVisual() {
  const members: Member[] = [
    { code: 'KC', name: 'Marcus', record: '7-2', profit: '+142', you: true },
    { code: 'BUF', name: 'Priya', record: '6-3', profit: '+98' },
    { code: 'PHI', name: 'Tyler', record: '5-4', profit: '+24' },
    { code: 'SF', name: 'Jordan', record: '4-5', profit: '-12' },
  ];
  return (
    <div className="w-[260px] rounded-2xl border border-white/[0.08] bg-arena-surface p-3 shadow-[0_16px_40px_rgba(0,0,0,0.3)]">
      <div className="mb-2 flex items-center justify-between font-display text-[13px] font-black tracking-[0.08em] text-electric-green">
        SUNDAY CREW · WK 9
        <span className="font-mono text-[9px] text-white/40">4/12</span>
      </div>
      {members.map((m) => (
        <div key={m.code} className="flex items-center gap-2.5 border-t border-white/[0.05] py-[7px]">
          <TeamCrest code={m.code} size={22} />
          <div className="flex-1 text-xs font-medium">
            {m.name}
            {m.you && (
              <span className="ml-1.5 rounded-[3px] bg-electric-green px-[5px] py-px text-[9px] font-bold tracking-[0.05em] text-arena-bg">
                YOU
              </span>
            )}
          </div>
          <div className="font-mono text-[11px] text-white/50">{m.record}</div>
          <div
            className="w-10 text-right font-mono text-xs font-semibold"
            style={{ color: m.profit.startsWith('+') ? '#00FF87' : '#FF4757' }}
          >
            {m.profit}
          </div>
        </div>
      ))}
    </div>
  );
}

function LineupVisual() {
  const rows: Array<{ type: string; text: string; profit: number; accent: string; lockBoost?: boolean }> = [
    { type: 'STRAIGHT', text: 'KC −3.5', profit: 23, accent: '#00FF87' },
    { type: 'PARLAY', text: '3-leg', profit: 148, accent: '#FFA502' },
    { type: 'TEASER', text: '2-team +6', profit: 36, accent: '#18DCFF' },
    { type: 'LOCK', text: 'KC −3.5', profit: 18, accent: '#FFD700', lockBoost: true },
  ];
  return (
    <div className="w-[260px] rounded-2xl border border-white/[0.08] bg-arena-surface p-3 shadow-[0_16px_40px_rgba(0,0,0,0.3)]">
      <div className="mb-2.5 flex items-center justify-between">
        <div className="font-display text-[13px] font-black tracking-[0.08em] text-amber-accent">YOUR LINEUP · WK 9</div>
        <div className="font-mono text-[10px] text-white/55">$78 / $100</div>
      </div>
      <div className="mb-3 h-1.5 overflow-hidden rounded bg-white/[0.06]">
        <div className="h-full w-[78%]" style={{ background: 'linear-gradient(90deg, #00FF87, #FFA502)' }} />
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map((row) => (
          <div
            key={row.type}
            className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-[7px]"
            style={{ borderLeft: `2px solid ${row.accent}` }}
          >
            <div className="w-14 font-display text-[9px] font-black tracking-[0.08em]" style={{ color: row.accent }}>
              {row.type}
            </div>
            <div className="flex-1 text-[11px] font-medium">
              {row.text}
              {row.lockBoost && <span className="ml-1 font-mono text-[8px] text-gold">1.5×</span>}
            </div>
            <div className="font-mono text-[10px] text-electric-green">+{row.profit}c</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CelebrationVisual() {
  // Sparkle positions computed once so they don't jump on re-render.
  const lines = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const angle = (i / 14) * Math.PI * 2;
        return {
          x1: 130 + Math.cos(angle) * 50,
          y1: 90 + Math.sin(angle) * 50,
          x2: 130 + Math.cos(angle) * 80,
          y2: 90 + Math.sin(angle) * 80,
          c: ['#00FF87', '#FFD700', '#FFA502', '#18DCFF'][i % 4],
        };
      }),
    [],
  );
  const dots = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => {
        const a = ((i * 137.5) % 360) * (Math.PI / 180);
        const r = 30 + ((i * 13) % 65);
        return {
          cx: 130 + Math.cos(a) * r,
          cy: 90 + Math.sin(a) * r,
          c: ['#00FF87', '#FFD700', '#48FFAB', '#FFD58A'][i % 4],
        };
      }),
    [],
  );
  return (
    <div className="relative flex h-[180px] w-[260px] items-center justify-center">
      <svg width="260" height="180" className="absolute inset-0" aria-hidden>
        {lines.map((l, i) => (
          <line
            key={`l${i}`}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke={l.c}
            strokeWidth="2.5"
            strokeLinecap="round"
            opacity="0.85"
          />
        ))}
        {dots.map((d, i) => (
          <circle key={`d${i}`} cx={d.cx} cy={d.cy} r="1.5" fill={d.c} opacity="0.85" />
        ))}
      </svg>
      <div className="relative z-[2] text-center">
        <div
          className="font-display text-[64px] font-black leading-[0.85] tracking-[-0.02em] text-electric-green"
          style={{ textShadow: '0 0 32px rgba(0,255,135,0.6)' }}
        >
          +148
        </div>
        <div className="mt-1 font-mono text-[10px] tracking-[0.12em] text-white/70">PARLAY HIT · WEEK 9</div>
      </div>
    </div>
  );
}

export function HowItRuns() {
  return (
    <section
      id="how-it-runs"
      aria-labelledby="how-it-runs-h2"
      className="bg-arena-surface px-5 py-14 text-textPrimary lg:px-14 lg:py-24"
    >
      <div className="mx-auto max-w-[1280px]">
        <div className="mb-8 max-w-[640px] lg:mb-14">
          <div className="mb-3.5 inline-block font-mono text-[11px] tracking-[0.16em] text-white/50">003 — HOW IT RUNS</div>
          <h2
            id="how-it-runs-h2"
            className="m-0 font-display text-[44px] font-black leading-[0.92] tracking-[-0.015em] lg:text-[72px]"
          >
            Three taps to a season-long argument with your friends.
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
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
