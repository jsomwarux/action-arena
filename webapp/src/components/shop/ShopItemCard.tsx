import { AnimatePresence, motion } from 'framer-motion';
import { Check, Circle, Ribbon, Sparkles } from 'lucide-react';

import { CosmeticPreview } from '@/components/cosmetics';
import { Button } from '@/components/ui';
import type { CosmeticItem } from '@/constants/cosmetics';
import { cn } from '@/lib/cn';

export type ShopItemCardProps = {
  canUseSeasonPassItem: boolean;
  equipped: boolean;
  item: CosmeticItem;
  loading: boolean;
  onEquip: (item: CosmeticItem) => void;
  onPreview: (item: CosmeticItem) => void;
  onPurchase: (item: CosmeticItem) => void;
  owned: boolean;
  recentlyPurchased: boolean;
};

/**
 * Port of the ShopItemCard in app/(app)/shop.tsx.
 *
 * The three-way button rule is mobile's, unchanged: a Season Pass exclusive the
 * player neither owns nor has a pass for is a disabled "Season Pass Required";
 * anything owned (or covered by an active pass) equips; everything else buys
 * with Arena Coins.
 *
 * The preview art is a button on the web as well as the phone, but here it also
 * opens the detail modal — a desktop pointer can hover and click for a closer
 * look, which a thumb-sized card had no room for. It fires the same
 * `shop_item_previewed` event mobile does.
 */
export function ShopItemCard({
  canUseSeasonPassItem,
  equipped,
  item,
  loading,
  onEquip,
  onPreview,
  onPurchase,
  owned,
  recentlyPurchased,
}: ShopItemCardProps) {
  const lockedExclusive = Boolean(item.seasonLabel && !canUseSeasonPassItem && !owned);

  return (
    <div
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-2xl border bg-white/[0.04]',
        equipped
          ? 'border-electric-green/55 shadow-[0_6px_14px_rgba(0,255,135,0.40)]'
          : 'border-white/[0.08]',
        item.seasonLabel && !equipped && 'border-gold/55 shadow-[0_6px_12px_rgba(255,215,0,0.30)]',
      )}>
      {item.seasonLabel ? (
        <div className="flex items-center justify-center gap-1.5 border-b border-gold/40 bg-gold/15 px-3 py-1.5">
          <Ribbon aria-hidden className="h-2.5 w-2.5 text-gold" />
          <p className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-gold">
            {item.seasonLabel}
          </p>
        </div>
      ) : null}

      <div className="flex flex-1 flex-col items-center gap-3 px-5 pb-5 pt-5">
        <div className="relative">
          <button
            aria-label={`Preview ${item.name}`}
            className="rounded-3xl transition duration-150 ease-arena hover:scale-[1.04] active:scale-[0.97]"
            onClick={() => onPreview(item)}
            type="button">
            <CosmeticPreview category={item.category} itemId={item.id} size="lg" />
          </button>

          {/* One-shot purchase sparkle. Mounted only while it plays, so a
              starved rAF leaves the card exactly as it was. */}
          <AnimatePresence>
            {recentlyPurchased ? (
              <motion.span
                animate={{ opacity: [0, 1, 0], scale: [0.6, 1.4, 1] }}
                aria-hidden
                className="pointer-events-none absolute inset-0 flex items-center justify-center"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.7, ease: 'easeOut', times: [0, 0.45, 1] }}>
                <Sparkles className="h-10 w-10 text-gold" />
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="flex w-full flex-col items-center gap-1.5">
          <p className="w-full truncate text-center text-base font-black tracking-[-0.01em] text-white">
            {item.name}
          </p>

          {equipped ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-electric-green/55 bg-electric-green/15 px-2.5 py-0.5 text-[10px] font-bold text-electric-green">
              <Check aria-hidden className="h-2.5 w-2.5" />
              Equipped
            </span>
          ) : owned ? (
            <span className="rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-semibold text-white/65">
              Owned
            </span>
          ) : null}

          <p className="line-clamp-2 text-center text-xs font-medium leading-4 text-white/55">
            {item.description}
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <Circle
            aria-hidden
            className="h-3 w-3"
            fill={item.seasonLabel ? '#FFD700' : item.accent}
            stroke="none"
          />
          <p className="text-xs font-bold text-white/75">
            {item.seasonLabel
              ? lockedExclusive
                ? 'Season Pass required'
                : 'Season Pass included'
              : `${item.cost} coins`}
          </p>
        </div>

        <div className="mt-auto w-full pt-1">
          {lockedExclusive ? (
            // Mobile's full "Season Pass Required" truncates in a four-up grid
            // cell; the price line directly above already spells it out.
            <Button disabled title="Pass Required" variant="secondary" />
          ) : owned || canUseSeasonPassItem ? (
            <Button
              disabled={equipped}
              loading={loading}
              onClick={() => onEquip(item)}
              title={equipped ? 'Equipped' : 'Equip'}
              variant={equipped ? 'secondary' : 'primary'}
            />
          ) : (
            <Button
              loading={loading}
              onClick={() => onPurchase(item)}
              title={`Buy · ${item.cost}`}
            />
          )}
        </div>
      </div>
    </div>
  );
}
