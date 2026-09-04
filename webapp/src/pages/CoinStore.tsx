import { useEffect } from 'react';

import { Building2, Package, ShieldCheck, Star, Wallet, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import { IOS_ONLY_BUTTON_LABEL, IosOnlyNotice } from '@/components/store/IosOnlyNotice';
import { AnimatedNumber, Button, Card, Notice, Skeleton } from '@/components/ui';
import { COIN_PACKS, type CoinPack } from '@/constants/cosmetics';
import { useAuth } from '@/hooks/use-auth';
import { useCoinPurchase } from '@/hooks/use-coin-purchase';
import { useUserCosmetics } from '@/hooks/use-cosmetics';
import { logAnalyticsEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { ROUTES } from '@/lib/routes';

type Tier = 'pouch' | 'chest' | 'vault';

const TIER_BY_PACK: Record<string, Tier> = {
  coins_500: 'pouch',
  coins_1200: 'chest',
  coins_2800: 'vault',
};

/** Copy, accents and tier ordering lifted verbatim from app/(app)/coin-store.tsx. */
const TIER_META: Record<
  Tier,
  {
    accent: string;
    bonus: string;
    icon: LucideIcon;
    subtitle: string;
    tagline: string;
  }
> = {
  pouch: {
    accent: '#FFA502',
    bonus: 'Base rate',
    icon: Wallet,
    subtitle: 'A small pouch of Arena Coins to dabble in cosmetics.',
    tagline: 'Day-one drip',
  },
  chest: {
    accent: '#18DCFF',
    bonus: '+20% coins',
    icon: Package,
    subtitle: 'A full chest with bonus coins for serious customizers.',
    tagline: 'Most popular',
  },
  vault: {
    accent: '#FFD700',
    bonus: '+40% coins · best value',
    icon: Building2,
    subtitle: 'An overflowing commissioner vault for full-loadout players.',
    tagline: 'Best value',
  },
};

/** Mobile's stacked-coin illusion: three offset circles behind a lettered plate. */
function CoinIconCluster({ accent, plateSize }: { accent: string; plateSize: number }) {
  const chip = plateSize * 0.32;

  return (
    <div className="relative shrink-0" style={{ height: plateSize, width: plateSize }}>
      <span
        aria-hidden
        className="absolute inset-0 rounded-full border"
        style={{
          backgroundColor: `${accent}1f`,
          borderColor: `${accent}55`,
          boxShadow: `0 0 18px ${accent}73`,
        }}
      />
      <span
        aria-hidden
        className="absolute rounded-full border"
        style={{
          backgroundColor: `${accent}33`,
          borderColor: `${accent}99`,
          bottom: plateSize * 0.18,
          height: chip,
          left: plateSize * 0.18,
          width: chip,
        }}
      />
      <span
        aria-hidden
        className="absolute rounded-full border"
        style={{
          backgroundColor: `${accent}33`,
          borderColor: `${accent}99`,
          bottom: plateSize * 0.18,
          height: chip,
          right: plateSize * 0.18,
          width: chip,
        }}
      />
      <span
        className="absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full font-black"
        style={{
          backgroundColor: `${accent}40`,
          borderColor: accent,
          borderStyle: 'solid',
          borderWidth: 2,
          boxShadow: `0 0 12px ${accent}`,
          color: accent,
          fontSize: plateSize * 0.14,
          height: plateSize * 0.45,
          top: plateSize * 0.08,
          width: plateSize * 0.45,
        }}>
        AA
      </span>
    </div>
  );
}

function PackHero({
  accent,
  icon: Icon,
  plateSize,
}: {
  accent: string;
  icon: LucideIcon;
  plateSize: number;
}) {
  return (
    <div className="relative shrink-0" style={{ height: plateSize, width: plateSize + 16 }}>
      <CoinIconCluster accent={accent} plateSize={plateSize} />
      <span
        className="absolute -top-1 right-0 flex items-center justify-center rounded-2xl border"
        style={{
          backgroundColor: `${accent}33`,
          borderColor: accent,
          boxShadow: `0 0 8px ${accent}80`,
          height: plateSize * 0.32,
          width: plateSize * 0.32,
        }}>
        <Icon aria-hidden style={{ color: accent, height: plateSize * 0.16, width: plateSize * 0.16 }} />
      </span>
    </div>
  );
}

function PackCard({
  isFeatured,
  pack,
  tier,
}: {
  isFeatured: boolean;
  pack: CoinPack;
  tier: Tier;
}) {
  const meta = TIER_META[tier];

  return (
    <div
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-2xl bg-white/[0.04]',
        isFeatured ? 'border-2' : 'border',
      )}
      style={{
        borderColor: isFeatured ? meta.accent : `${meta.accent}55`,
        boxShadow: `0 8px ${isFeatured ? 22 : 14}px ${meta.accent}${isFeatured ? '8c' : '4d'}`,
      }}>
      {isFeatured ? (
        <div
          className="flex items-center justify-center gap-1.5 border-b px-3 py-1.5"
          style={{ backgroundColor: `${meta.accent}26`, borderColor: `${meta.accent}66` }}>
          <Star aria-hidden className="h-3 w-3" style={{ color: meta.accent }} />
          <p
            className="truncate text-[10px] font-black uppercase tracking-[0.16em]"
            style={{ color: meta.accent }}>
            {meta.tagline}
          </p>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col items-center gap-3 p-5 text-center">
        <PackHero accent={meta.accent} icon={meta.icon} plateSize={isFeatured ? 124 : 96} />

        <p
          className="text-xs font-semibold uppercase tracking-[0.12em]"
          style={{ color: meta.accent }}>
          {pack.label}
        </p>

        <p className="flex items-baseline gap-2">
          <span className="text-4xl font-extrabold tracking-[-0.02em] text-white">
            {pack.coins.toLocaleString()}
          </span>
          <span className="text-sm font-bold" style={{ color: `${meta.accent}cc` }}>
            coins
          </span>
        </p>

        <p className="text-xs font-medium leading-5 text-white/65">{meta.subtitle}</p>

        <span
          className="rounded-full border px-3 py-1 text-[11px] font-bold"
          style={{
            backgroundColor: `${meta.accent}22`,
            borderColor: `${meta.accent}66`,
            color: meta.accent,
          }}>
          {meta.bonus}
        </span>

        {/* Disabled on purpose: Apple In-App Purchase has no browser surface, so
            there is nothing behind this button on the web. See IosOnlyNotice. */}
        <div className="mt-auto w-full pt-2">
          <Button disabled title={IOS_ONLY_BUTTON_LABEL} variant="secondary" />
        </div>
      </div>
    </div>
  );
}

/**
 * Port of app/(app)/coin-store.tsx.
 *
 * The packs, their coin counts, bonus lines and tier ordering are mobile's.
 * What changes is the transaction: `useCoinPurchase` is a web stub with no
 * store to talk to, so every CTA renders disabled and labelled rather than
 * calling a purchase that can only fail. The balance, which is real, is read
 * from the same `get_my_arena_coin_balance` RPC the shop uses.
 *
 * Coins are cosmetic-only currency (AGENTS.md), so nothing on this page can
 * gate play: a player who never buys a pack still gets the full weekly card,
 * every league feature, and the 500 starting coins.
 */
export function CoinStorePage() {
  const { user } = useAuth();
  const cosmeticsQuery = useUserCosmetics(user?.id);
  const coinPurchase = useCoinPurchase(user?.id);

  useEffect(() => {
    logAnalyticsEvent('coin_store_viewed', { user_id: user?.id });
  }, [user?.id]);

  return (
    <section className="flex flex-col gap-6">
      <header className="min-w-0">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-gold">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold" />
          Arena Coins
        </p>
        <h1 className="arena-heading mt-1 text-5xl leading-none">Coin Store</h1>
        <p className="mt-2 max-w-2xl text-textMuted">
          Stock up on coins to unlock cosmetics in the Arena Locker.
        </p>
      </header>

      <IosOnlyNotice message={coinPurchase.error} />

      <Card tone="highlight">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-electric-green">
              Current Balance
            </p>
            {cosmeticsQuery.isLoading ? (
              <div className="mt-2">
                <Skeleton height={36} width={120} />
              </div>
            ) : (
              <AnimatedNumber
                className="mt-1 block text-4xl font-extrabold tracking-[-0.02em] text-white"
                value={cosmeticsQuery.data?.coinBalance ?? 0}
              />
            )}
            <p className="mt-2 text-sm font-medium text-white/55">
              Coins you already hold spend normally in the{' '}
              <Link className="font-bold text-electric-green hover:underline" to={ROUTES.shop}>
                Arena Locker
              </Link>
              .
            </p>
          </div>
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl border border-gold/65 bg-gold/15 text-xl font-black text-gold shadow-[0_0_14px_rgba(255,215,0,0.55)]">
            AA
          </span>
        </div>
      </Card>

      {cosmeticsQuery.isError ? (
        <Notice tone="error">
          Could not load your coin balance.{' '}
          {cosmeticsQuery.error instanceof Error ? cosmeticsQuery.error.message : 'Try again.'}
        </Notice>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {COIN_PACKS.map((pack) => {
          const tier = TIER_BY_PACK[pack.id] ?? 'pouch';
          return (
            <PackCard isFeatured={tier === 'vault'} key={pack.id} pack={pack} tier={tier} />
          );
        })}
      </div>

      <Card>
        <div className="flex items-center gap-2">
          <ShieldCheck aria-hidden className="h-3.5 w-3.5 text-white/55" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/55">
            Virtual Coins Only
          </p>
        </div>
        <p className="mt-1 text-xs font-medium leading-5 text-white/55">
          Arena Coins only unlock cosmetics. Every weekly card uses virtual-coin budgets.
        </p>
      </Card>
    </section>
  );
}
