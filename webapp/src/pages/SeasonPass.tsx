import { useEffect, useState } from 'react';

import {
  BarChart3,
  CheckCircle2,
  Clock,
  Ribbon,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

import { CosmeticPreview } from '@/components/cosmetics';
import {
  IOS_ONLY_BUY_LABEL,
  IOS_ONLY_RESTORE_LABEL,
  IosOnlyNotice,
} from '@/components/store/IosOnlyNotice';
import { Badge, Button, Card, Notice, TextInput } from '@/components/ui';
import {
  CURRENT_SEASON_YEAR,
  SEASON_PASS_COSMETICS,
  type CosmeticItem,
} from '@/constants/cosmetics';
import { useAuth } from '@/hooks/use-auth';
import { useRedeemSeasonPassMutation, useSeasonPass } from '@/hooks/use-season-pass';
import { useSeasonPassPurchase } from '@/hooks/use-season-pass-purchase';
import { logAnalyticsEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';

/** Perk copy lifted verbatim from app/(app)/season-pass.tsx. */
const PASS_FEATURES: {
  body: string;
  highlight: string;
  icon: LucideIcon;
  title: string;
}[] = [
  {
    body: 'Claim your founder identity with an exclusive team logo, profile frame, Pick of the Week effect, and legacy trophy skin.',
    highlight: '4 exclusive cosmetics',
    icon: Sparkles,
    title: `Season ${CURRENT_SEASON_YEAR} Exclusive Drops`,
  },
  {
    body: 'Win-rate splits, weekly score trends, hit rates by pick type, and best/toughest team reads. Permanent unlock.',
    highlight: 'Charts + trends',
    icon: BarChart3,
    title: 'Advanced Analytics Dashboard',
  },
  {
    body: 'See new weekly matchups 30 minutes before free users every week. Build your card before the Pick Board opens.',
    highlight: '30-minute head start',
    icon: Clock,
    title: 'Early Pick Board Access',
  },
  {
    body: 'No ad placements once the ad SDK arrives. For now, the app simply hides all ad hooks for pass holders.',
    highlight: 'Future ad-free hooks',
    icon: ShieldCheck,
    title: 'Ad-Free Experience',
  },
];

const SEASON_PASS_ACTIVE_MESSAGE =
  'Season Pass active. Exclusive drops and analytics are unlocked.';

function HeroCard({ hasPass }: { hasPass: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border-2 border-gold bg-gold/[0.10] shadow-[0_10px_22px_rgba(255,215,0,0.55)]">
      <div className="flex items-center justify-center gap-2 border-b border-gold/40 bg-gold/15 py-2">
        <Ribbon aria-hidden className="h-3 w-3 text-gold" />
        <p className="arena-eyebrow text-gold">
          Season {CURRENT_SEASON_YEAR} Pass
        </p>
        <Ribbon aria-hidden className="h-3 w-3 text-gold" />
      </div>

      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold/85">
              {hasPass ? 'Your All-Access Pass' : 'All-Access Pass'}
            </p>
            <h2 className="mt-1.5 text-2xl font-extrabold tracking-[-0.01em] text-white">
              {hasPass ? 'Your season is unlocked.' : 'Buy your ticket to the season.'}
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm font-medium leading-6 text-white/65">
              {hasPass
                ? `You are in the Season ${String(CURRENT_SEASON_YEAR)} founders’ class. All four perks are live for the full season — detailed below.`
                : `Season ${String(CURRENT_SEASON_YEAR)} pass holders join the founders’ class. Four perks unlock for the full season — detailed below.`}
            </p>
          </div>

          <div className="flex flex-col items-end">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gold/80">
              Launch
            </p>
            <p className="text-xl font-extrabold tracking-[-0.02em] text-white">
              {hasPass ? 'Active' : 'iOS'}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gold">
              {hasPass ? 'Unlocked' : 'Or redeem a code'}
            </p>
          </div>
        </div>

        {hasPass ? (
          <div className="flex items-center gap-2 rounded-xl border border-electric-green/45 bg-electric-green/15 px-3 py-2">
            <CheckCircle2 aria-hidden className="h-3.5 w-3.5 shrink-0 text-electric-green" />
            <p className="text-xs font-bold text-electric-green">{SEASON_PASS_ACTIVE_MESSAGE}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FeatureCard({
  body,
  highlight,
  icon: Icon,
  index,
  title,
}: {
  body: string;
  highlight: string;
  icon: LucideIcon;
  index: number;
  title: string;
}) {
  return (
    <Card className="h-full">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-gold/45 bg-gold/15 shadow-[0_0_10px_rgba(255,215,0,0.45)]">
          <Icon aria-hidden className="h-5 w-5 text-gold" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gold/80">
              Perk {String(index + 1).padStart(2, '0')}
            </p>
            <span className="rounded-full border border-gold/45 bg-gold/15 px-2 py-px text-[10px] font-bold text-gold">
              {highlight}
            </span>
          </div>
          <p className="mt-1.5 text-base font-extrabold tracking-[-0.01em] text-white">{title}</p>
          <p className="mt-1.5 text-sm font-medium leading-6 text-white/60">{body}</p>
        </div>
      </div>
    </Card>
  );
}

/** Faux sparkline + best-team read: a teaser for the locked analytics dashboard. */
function AnalyticsTeaser() {
  const sparkline = [12, 18, 26, 22, 32, 41, 36, 48, 56, 62];
  const max = Math.max(...sparkline);

  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 aria-hidden className="h-3.5 w-3.5 text-cyan-accent" />
            <p className="arena-eyebrow text-cyan-accent">Inside the Lab</p>
          </div>
          <Badge label="Pass Only" tone="gold" />
        </div>

        <p className="text-base font-extrabold tracking-[-0.01em] text-white">
          Trends that win you next week
        </p>

        <div className="flex h-20 items-end gap-1 rounded-2xl border border-cyan-accent/25 bg-cyan-accent/[0.06] p-3">
          {sparkline.map((value, index) => (
            <span
              className={cn(
                'flex-1 rounded-md',
                index === sparkline.length - 1 ? 'bg-cyan-accent' : 'bg-cyan-accent/40',
              )}
              key={`${value}-${index}`}
              style={{ height: `${4 + (value / max) * 70}%` }}
            />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-2xl border border-electric-green/25 bg-electric-green/[0.06] p-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-electric-green">
              Best team to pick
            </p>
            <p className="text-base font-extrabold text-white">Eagles +6.5</p>
            <p className="text-[11px] font-medium text-white/55">
              4-1 ATS · +84 coins across 5 settled picks
            </p>
          </div>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-electric-green/45 bg-electric-green/15">
            <TrendingUp aria-hidden className="h-5 w-5 text-electric-green" />
          </span>
        </div>
      </div>
    </Card>
  );
}

function ExclusiveCosmeticCard({ item }: { item: CosmeticItem }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border-2 border-gold bg-gold/[0.10] shadow-[0_6px_14px_rgba(255,215,0,0.40)]">
      <div className="flex items-center justify-center gap-1.5 border-b border-gold/45 bg-gold/15 px-3 py-1.5">
        <Ribbon aria-hidden className="h-2.5 w-2.5 text-gold" />
        <p className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-gold">
          {item.seasonLabel ?? 'Season Pass Exclusive'}
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center gap-3 px-4 pb-4 pt-5 text-center">
        <CosmeticPreview category={item.category} itemId={item.id} size="lg" />
        <div>
          <p className="truncate text-base font-extrabold tracking-[-0.01em] text-white">
            {item.name}
          </p>
          <p className="mt-1 text-xs font-medium leading-4 text-white/60">{item.description}</p>
        </div>
        <span className="mt-auto rounded-full border border-gold/45 bg-gold/15 px-2.5 py-0.5 text-[10px] font-bold text-gold">
          Status symbol · proves you were here Day 1
        </span>
      </div>
    </div>
  );
}

/**
 * Port of app/(app)/season-pass.tsx.
 *
 * The pass gates premium extras only — exclusive cosmetics, analytics, the
 * 30-minute early Pick Board window, and future ad-free hooks. Per AGENTS.md no
 * gameplay sits behind it, and nothing on this page changes that.
 *
 * Two of the three ways in survive on the web unchanged: an existing pass is
 * read from `season_passes`, and the redeem-code flow calls the same
 * `redeem_season_pass` RPC mobile does, granting the Season Pass cosmetics on
 * success. The third — Apple In-App Purchase, and the Restore that pairs with
 * it — has no browser surface, so both render as disabled, labelled controls
 * rather than buttons wired to a call that can only fail.
 */
export function SeasonPassPage() {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);

  const seasonPassQuery = useSeasonPass(user?.id);
  const redeemSeasonPass = useRedeemSeasonPassMutation(user?.id);
  const seasonPassPurchase = useSeasonPassPurchase(user?.id);
  const hasPass = Boolean(seasonPassQuery.data);

  useEffect(() => {
    logAnalyticsEvent('season_pass_screen_viewed', {
      season_year: CURRENT_SEASON_YEAR,
      user_id: user?.id,
    });
  }, [user?.id]);

  const redeem = async () => {
    if (!code.trim()) {
      setMessage({ text: 'Enter a Season Pass code to redeem.', tone: 'error' });
      return;
    }

    setMessage(null);

    try {
      await redeemSeasonPass.mutateAsync(code);
      haptics.success();
      setMessage({
        text: 'Season Pass unlocked. Exclusive cosmetics and analytics are active.',
        tone: 'success',
      });
      setCode('');
    } catch (error) {
      haptics.warning();
      setMessage({
        text: `Could not redeem. ${error instanceof Error ? error.message : 'Try again.'}`,
        tone: 'error',
      });
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <header className="min-w-0">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold" />
          Season {CURRENT_SEASON_YEAR} Pass
        </p>
        <h1 className="arena-heading mt-1 text-5xl leading-none">
          {hasPass ? 'Your Season Pass' : 'All-Access Pass'}
        </h1>
        <p className="mt-2 max-w-2xl text-textMuted">
          {hasPass
            ? 'Everything below is already yours for the season.'
            : 'One ticket. The whole season unlocked.'}
        </p>
      </header>

      <HeroCard hasPass={hasPass} />

      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className={cn('arena-eyebrow', hasPass ? 'text-electric-green' : 'text-gold')}>
                {hasPass ? 'Pass Active' : 'Apple In-App Purchase'}
              </p>
              <p className="mt-0.5 text-base font-bold text-white">
                {hasPass ? 'You’re all set for the season' : 'Unlock Season Pass'}
              </p>
            </div>
            {hasPass ? <Badge label="Active" tone="green" /> : <Badge label="One-Time" tone="gold" />}
          </div>

          <p className="text-sm font-medium leading-6 text-white/60">
            {hasPass
              ? `Season ${CURRENT_SEASON_YEAR} cosmetics, advanced analytics, early Pick Board access and future ad-free hooks are unlocked on this account, on web and on iOS.`
              : `A one-time Apple purchase unlocks Season ${CURRENT_SEASON_YEAR} cosmetics, analytics, early Pick Board access, and future ad-free hooks.`}
          </p>

          {/* An active holder has nothing left to buy, restore or redeem, so
              none of the purchase surface renders for them — it used to, and
              told someone whose badge already read PASS ACTIVE to go redeem a
              code. */}
          {!hasPass ? (
            <>
              <IosOnlyNotice message={seasonPassPurchase.error} />

              {/* Both disabled on purpose — see IosOnlyNotice. Redeem below is live. */}
              <div className="grid gap-3 sm:grid-cols-2">
                <Button disabled title={IOS_ONLY_BUY_LABEL} variant="secondary" />
                <Button disabled title={IOS_ONLY_RESTORE_LABEL} variant="secondary" />
              </div>
            </>
          ) : (
            <Notice tone="success">
              Season Pass active. Nothing else to buy — every perk below is already yours.
            </Notice>
          )}

          {!hasPass ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
                    Redeem Code
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-white">Reviewer or promo code</p>
                </div>
                <Badge label="Works on web" tone="green" />
              </div>

              <TextInput
                autoCapitalize="characters"
                label="Redeem Code"
                onChange={(event) => setCode(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void redeem();
                  }
                }}
                placeholder="ENTER-CODE"
                value={code}
              />

              <Button
                loading={redeemSeasonPass.isPending}
                onClick={() => {
                  void redeem();
                }}
                title="Redeem Pass"
                variant="secondary"
              />
            </div>
          ) : null}

          {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        </div>
      </Card>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-electric-green">
          {hasPass ? "What you've got" : "What's inside"}
        </p>
        <p className="mt-0.5 text-base font-bold tracking-[-0.01em] text-white">
          {hasPass ? 'Four perks · all active' : 'Four perks · launch-ready preview'}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {PASS_FEATURES.map((feature, index) => (
          <FeatureCard
            body={feature.body}
            highlight={feature.highlight}
            icon={feature.icon}
            index={index}
            key={feature.title}
            title={feature.title}
          />
        ))}
      </div>

      <AnalyticsTeaser />

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gold">
          Season {CURRENT_SEASON_YEAR} Exclusive Drops
        </p>
        <p className="mt-0.5 text-base font-bold tracking-[-0.01em] text-white">
          Status symbols. Limited to founders.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SEASON_PASS_COSMETICS.map((item) => (
          <ExclusiveCosmeticCard item={item} key={item.id} />
        ))}
      </div>
    </section>
  );
}
