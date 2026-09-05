import { useEffect, useMemo, useState } from 'react';

import {
  ChevronRight,
  Flame,
  MessageCircle,
  Ribbon,
  Shield,
  Sparkles,
  SquareDashed,
  Trophy,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';

import { CosmeticDetailModal } from '@/components/shop/CosmeticDetailModal';
import { ShopItemCard } from '@/components/shop/ShopItemCard';
import { AnimatedNumber, Badge, Card, Notice, Skeleton, StaggeredItem } from '@/components/ui';
import {
  COSMETIC_CATEGORIES,
  COSMETIC_CATEGORY_DESCRIPTIONS,
  COSMETIC_CATEGORY_LABELS,
  COSMETIC_ITEMS,
  SEASON_PASS_COSMETICS,
  type CosmeticItem,
} from '@/constants/cosmetics';
import { useAuth } from '@/hooks/use-auth';
import {
  useEquipCosmeticMutation,
  usePurchaseCosmeticMutation,
  useUserCosmetics,
} from '@/hooks/use-cosmetics';
import { useSeasonPass } from '@/hooks/use-season-pass';
import { logAnalyticsEvent } from '@/lib/analytics';
import { cn } from '@/lib/cn';
import { haptics } from '@/lib/haptics';
import { ROUTES } from '@/lib/routes';
import type { CosmeticCategory } from '@/types/database';

/** Mobile's Ionicons per category, mapped onto the lucide set the web uses. */
const CATEGORY_ICON: Record<CosmeticCategory, LucideIcon> = {
  chat_sticker_pack: MessageCircle,
  lock_effect: Flame,
  profile_frame: SquareDashed,
  team_logo: Shield,
  trophy_skin: Trophy,
  win_celebration: Sparkles,
};

function CategoryTab({
  active,
  category,
  onSelect,
}: {
  active: boolean;
  category: CosmeticCategory;
  onSelect: () => void;
}) {
  const Icon = CATEGORY_ICON[category];

  return (
    <button
      aria-selected={active}
      className={cn(
        'flex shrink-0 items-center gap-2 rounded-full border px-4 py-2',
        'transition duration-150 ease-arena',
        active
          ? 'border-electric-green/55 bg-electric-green/15 text-electric-green shadow-[0_0_10px_rgba(0,255,135,0.45)]'
          : 'border-white/10 bg-white/[0.04] text-white/60 hover:text-white/85',
      )}
      onClick={onSelect}
      role="tab"
      type="button">
      <Icon aria-hidden className="h-3.5 w-3.5" />
      <span className="text-[11px] font-bold">{COSMETIC_CATEGORY_LABELS[category]}</span>
    </button>
  );
}

function CoinHeader({
  coinBalance,
  hasPass,
  loading,
}: {
  coinBalance: number;
  hasPass: boolean;
  loading: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gold/55 bg-gold/[0.10] shadow-[0_6px_16px_rgba(255,215,0,0.40)]">
      <div className="flex items-center gap-3 p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-gold/65 bg-gold/15 text-base font-black text-gold shadow-[0_0_12px_rgba(255,215,0,0.55)]">
          AA
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gold">
            Arena Coins
          </p>
          {loading ? (
            <div className="mt-1">
              <Skeleton height={26} width={120} />
            </div>
          ) : (
            <AnimatedNumber
              className="mt-0.5 block text-2xl font-extrabold tracking-[-0.02em] text-white"
              value={coinBalance}
            />
          )}
        </div>

        <Link
          className="rounded-full border border-gold bg-gold/30 px-3 py-2 text-xs font-black uppercase tracking-[0.08em] text-gold shadow-[0_0_8px_rgba(255,215,0,0.50)] transition hover:brightness-110"
          to={ROUTES.coinStore}>
          Get Coins
        </Link>
      </div>

      {/* A holder is not sold the pass again — the same `seasonPassQuery` the
          PASS ACTIVE badge reads decides which sentence this is. */}
      <Link
        className="flex items-center justify-center gap-1.5 border-t border-gold/30 bg-gold/[0.05] py-2 text-[11px] font-bold text-gold transition hover:bg-gold/[0.10]"
        to={ROUTES.seasonPass}>
        <Ribbon aria-hidden className="h-3 w-3" />
        {hasPass
          ? 'Season Pass active — your exclusive drops are unlocked'
          : 'Unlock the Season Pass for exclusive drops'}
        <ChevronRight aria-hidden className="h-3 w-3" />
      </Link>
    </div>
  );
}

/**
 * Port of app/(app)/shop.tsx — the Arena Locker.
 *
 * Every rule is mobile's, because both clients call the same two RPCs:
 * `purchase_cosmetic` debits Arena Coins and refuses when the balance is short,
 * and `equip_cosmetic` refuses anything unowned and unequips whatever else held
 * that category. Season Pass exclusives cost no coins and unlock with the pass.
 *
 * Nothing on this page touches gameplay — per AGENTS.md, cosmetics are the only
 * thing Arena Coins buy, and no league, pick or standing depends on them.
 *
 * Two web-side differences, both presentation only: mobile's `Alert.alert`
 * confirmations become an inline Notice (browsers have no equivalent modal that
 * doesn't block), and the two-column FlatList becomes a responsive grid that
 * uses the desktop width.
 */
export function ShopPage() {
  const { user } = useAuth();
  const [category, setCategory] = useState<CosmeticCategory>('team_logo');
  const [recentPurchaseId, setRecentPurchaseId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<CosmeticItem | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);

  const cosmeticsQuery = useUserCosmetics(user?.id);
  const seasonPassQuery = useSeasonPass(user?.id);
  const purchaseCosmetic = usePurchaseCosmeticMutation(user?.id);
  const equipCosmetic = useEquipCosmeticMutation(user?.id);

  const items = useMemo(() => {
    const baseItems = COSMETIC_ITEMS.filter((item) => item.category === category);
    const exclusiveItems = SEASON_PASS_COSMETICS.filter((item) => item.category === category);
    return [...baseItems, ...exclusiveItems];
  }, [category]);

  useEffect(() => {
    logAnalyticsEvent('shop_viewed', { category, user_id: user?.id });
  }, [category, user?.id]);

  useEffect(() => {
    if (!recentPurchaseId) return undefined;
    const timer = window.setTimeout(() => setRecentPurchaseId(null), 1200);
    return () => window.clearTimeout(timer);
  }, [recentPurchaseId]);

  const ownedByItemId = cosmeticsQuery.data?.ownedByItemId ?? {};
  const equippedByCategory = cosmeticsQuery.data?.equippedByCategory ?? {};
  const canUseSeasonPassItem = Boolean(seasonPassQuery.data);
  const ownedCountForCategory = items.filter(
    (item) => ownedByItemId[item.id] || (item.seasonLabel && canUseSeasonPassItem),
  ).length;

  const onPurchase = async (item: CosmeticItem) => {
    haptics.medium();
    setMessage(null);

    try {
      await purchaseCosmetic.mutateAsync(item.id);
      haptics.success();
      setRecentPurchaseId(item.id);
      setMessage({ text: `${item.name} is now in your locker.`, tone: 'success' });
    } catch (error) {
      haptics.warning();
      setMessage({
        text: `Could not purchase. ${error instanceof Error ? error.message : 'Try again.'}`,
        tone: 'error',
      });
    }
  };

  const onEquip = async (item: CosmeticItem) => {
    haptics.light();
    setMessage(null);

    try {
      await equipCosmetic.mutateAsync(item.id);
      haptics.success();
      setMessage({ text: `${item.name} equipped.`, tone: 'success' });
    } catch (error) {
      haptics.warning();
      setMessage({
        text: `Could not equip. ${error instanceof Error ? error.message : 'Try again.'}`,
        tone: 'error',
      });
    }
  };

  const onPreview = (item: CosmeticItem) => {
    haptics.selection();
    setDetailItem(item);
    logAnalyticsEvent('shop_item_previewed', {
      category: item.category,
      coin_cost: item.cost,
      item_id: item.id,
      is_season_pass_exclusive: Boolean(item.seasonLabel),
      user_id: user?.id,
    });
  };

  const isMutating = purchaseCosmetic.isPending || equipCosmetic.isPending;

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-electric-green">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-electric-green" />
            Cosmetics Shop
          </p>
          <h1 className="arena-heading mt-1 text-5xl leading-none">Arena Locker</h1>
          <p className="mt-2 max-w-2xl text-textMuted">
            Loadout drops only — gameplay stays free for every player.
          </p>
        </div>

        <div className="w-full max-w-sm">
          <CoinHeader
            coinBalance={cosmeticsQuery.data?.coinBalance ?? 0}
            hasPass={canUseSeasonPassItem}
            loading={cosmeticsQuery.isLoading}
          />
        </div>
      </header>

      {cosmeticsQuery.isError ? (
        <Notice tone="error">
          Could not load your locker.{' '}
          {cosmeticsQuery.error instanceof Error ? cosmeticsQuery.error.message : 'Try again.'}
        </Notice>
      ) : null}

      {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}

      <div className="flex flex-wrap gap-2" role="tablist">
        {COSMETIC_CATEGORIES.map((option) => (
          <CategoryTab
            active={category === option}
            category={option}
            key={option}
            onSelect={() => {
              haptics.selection();
              setCategory(option);
            }}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm font-medium text-white/60">
          {COSMETIC_CATEGORY_DESCRIPTIONS[category]}
        </p>
        <Badge
          label={`${ownedCountForCategory}/${items.length} owned`}
          tone={ownedCountForCategory >= items.length ? 'green' : 'gold'}
        />
      </div>

      {cosmeticsQuery.isLoading ? (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((key) => (
            <Skeleton height={280} key={key} radius={16} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {items.map((item, index) => (
            <StaggeredItem className="h-full" index={index} key={item.id}>
              <ShopItemCard
                canUseSeasonPassItem={canUseSeasonPassItem}
                equipped={equippedByCategory[item.category]?.item_id === item.id}
                item={item}
                loading={isMutating}
                onEquip={onEquip}
                onPreview={onPreview}
                onPurchase={onPurchase}
                owned={Boolean(ownedByItemId[item.id])}
                recentlyPurchased={recentPurchaseId === item.id}
              />
            </StaggeredItem>
          ))}
        </div>
      )}

      <Card>
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/45">
          One equipped item per category
        </p>
        <p className="mt-1.5 text-sm font-medium leading-6 text-white/55">
          Equipping a cosmetic replaces whatever else held that slot. Owned items stay in your
          locker either way — a purchase is never lost by equipping something else.
        </p>
      </Card>

      <CosmeticDetailModal
        canUseSeasonPassItem={canUseSeasonPassItem}
        equipped={
          detailItem ? equippedByCategory[detailItem.category]?.item_id === detailItem.id : false
        }
        item={detailItem}
        loading={isMutating}
        onClose={() => setDetailItem(null)}
        onEquip={(item) => {
          void onEquip(item);
          setDetailItem(null);
        }}
        onPurchase={(item) => {
          void onPurchase(item);
          setDetailItem(null);
        }}
        owned={detailItem ? Boolean(ownedByItemId[detailItem.id]) : false}
      />
    </section>
  );
}
