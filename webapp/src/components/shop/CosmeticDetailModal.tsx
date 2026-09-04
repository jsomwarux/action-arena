import { Check, Circle, Lock, Ribbon } from 'lucide-react';

import { CosmeticAvatar, CosmeticPreview, LockEffect } from '@/components/cosmetics';
import { Badge, Button, Modal } from '@/components/ui';
import {
  COSMETIC_CATEGORY_DESCRIPTIONS,
  COSMETIC_CATEGORY_LABELS,
  type CosmeticItem,
} from '@/constants/cosmetics';
import type { UserCosmeticRow } from '@/types/database';

export type CosmeticDetailModalProps = {
  canUseSeasonPassItem: boolean;
  equipped: boolean;
  item: CosmeticItem | null;
  loading: boolean;
  onClose: () => void;
  onEquip: (item: CosmeticItem) => void;
  onPurchase: (item: CosmeticItem) => void;
  owned: boolean;
};

/**
 * A stand-in `user_cosmetics` row so the shared cosmetics components can render
 * an item the player may not own yet. Nothing is written or read back — this
 * value never leaves the modal.
 */
function previewRow(item: CosmeticItem): UserCosmeticRow {
  return {
    category: item.category,
    equipped_at: null,
    id: `preview-${item.id}`,
    is_equipped: true,
    item_id: item.id,
    metadata: {},
    purchased_at: '',
    user_id: 'preview',
  };
}

/**
 * Desktop close-up for one cosmetic.
 *
 * Mobile's shop card is already the whole item — a phone has no room for more —
 * so this modal adds no rule of its own: the same three-way action from
 * ShopItemCard is repeated here, and the item is shown where it will actually
 * appear in play (on a player card, or wrapped around a Pick of the Week) so a
 * purchase can be judged before coins are spent. Every piece of art comes from
 * the shared components/cosmetics module; nothing is redrawn locally.
 */
export function CosmeticDetailModal({
  canUseSeasonPassItem,
  equipped,
  item,
  loading,
  onClose,
  onEquip,
  onPurchase,
  owned,
}: CosmeticDetailModalProps) {
  if (!item) {
    return null;
  }

  const lockedExclusive = Boolean(item.seasonLabel && !canUseSeasonPassItem && !owned);
  const showsOnPlayerCard = item.category === 'team_logo' || item.category === 'profile_frame';

  return (
    <Modal
      className="max-w-xl"
      footer={
        lockedExclusive ? (
          <Button disabled fullWidth={false} title="Season Pass Required" variant="secondary" />
        ) : owned || canUseSeasonPassItem ? (
          <Button
            disabled={equipped}
            fullWidth={false}
            loading={loading}
            onClick={() => onEquip(item)}
            title={equipped ? 'Equipped' : 'Equip'}
            variant={equipped ? 'secondary' : 'primary'}
          />
        ) : (
          <Button
            fullWidth={false}
            loading={loading}
            onClick={() => onPurchase(item)}
            title={`Buy · ${item.cost} coins`}
          />
        )
      }
      onClose={onClose}
      open
      subtitle={COSMETIC_CATEGORY_DESCRIPTIONS[item.category]}
      title={item.name}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge label={COSMETIC_CATEGORY_LABELS[item.category]} tone="neutral" />
          {item.seasonLabel ? (
            <Badge icon={Ribbon} label={item.seasonLabel} tone="gold" />
          ) : (
            <Badge label={`${item.cost} coins`} tone="gold" />
          )}
          {equipped ? <Badge icon={Check} label="Equipped" tone="green" /> : null}
          {!equipped && owned ? <Badge label="Owned" tone="neutral" /> : null}
          {lockedExclusive ? <Badge icon={Lock} label="Locked" tone="red" /> : null}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-8 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6">
          <div className="flex flex-col items-center gap-2">
            <CosmeticPreview category={item.category} itemId={item.id} size="lg" />
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
              Item art
            </p>
          </div>

          {showsOnPlayerCard ? (
            <div className="flex flex-col items-center gap-2">
              <CosmeticAvatar
                cosmetics={{ [item.category]: previewRow(item) }}
                name={item.name}
                size="lg"
              />
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                On your card
              </p>
            </div>
          ) : null}

          {item.category === 'lock_effect' ? (
            <div className="flex flex-col items-center gap-2">
              <LockEffect cosmetics={{ lock_effect: previewRow(item) }}>
                <span className="flex h-16 items-center rounded-2xl border border-white/12 bg-white/[0.05] px-4 text-xs font-black uppercase tracking-[0.12em] text-white">
                  Pick of the Week
                </span>
              </LockEffect>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/40">
                On your Pick of the Week
              </p>
            </div>
          ) : null}
        </div>

        <p className="text-sm font-semibold leading-6 text-white/70">{item.description}</p>

        <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
          <Circle aria-hidden className="h-3 w-3 shrink-0" fill={item.accent} stroke="none" />
          <p className="text-xs font-semibold text-white/55">
            {lockedExclusive
              ? 'Included with the Season Pass. Redeem a pass code to unlock it.'
              : item.seasonLabel
                ? 'Included with your Season Pass — no coins needed.'
                : 'Cosmetic only. Nothing here changes budgets, odds or scoring.'}
          </p>
        </div>
      </div>
    </Modal>
  );
}
