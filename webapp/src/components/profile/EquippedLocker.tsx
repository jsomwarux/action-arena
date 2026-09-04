import { ChevronRight, Store } from 'lucide-react';
import { Link } from 'react-router-dom';

import { CosmeticIcon } from '@/components/cosmetics';
import { Card } from '@/components/ui';
import {
  COSMETIC_CATEGORIES,
  COSMETIC_CATEGORY_LABELS,
  getCosmeticItem,
} from '@/constants/cosmetics';
import { cn } from '@/lib/cn';
import { ROUTES } from '@/lib/routes';
import type { EquippedCosmeticsByCategory } from '@/types/database';

/**
 * What the player currently has equipped, one row per cosmetic category.
 *
 * The phone reaches this by opening the shop and reading the "Equipped" chips
 * there. On a desktop profile there is room to answer it in place, so the shop
 * link becomes a follow-up rather than the only way to find out. Empty
 * categories are listed too — the gap is the reason to visit the shop.
 */
export function EquippedLocker({
  cosmetics,
  isLoading = false,
}: {
  cosmetics: EquippedCosmeticsByCategory | undefined;
  isLoading?: boolean;
}) {
  const equippedCount = COSMETIC_CATEGORIES.filter((category) => cosmetics?.[category]).length;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[1.2px] text-electric-green">
            Equipped
          </p>
          <h2 className="mt-0.5 text-lg font-extrabold tracking-[-0.2px] text-white">
            Cosmetics Loadout
          </h2>
        </div>
        <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-black uppercase tracking-[1.2px] text-white/55">
          {isLoading ? '—' : `${String(equippedCount)}/${String(COSMETIC_CATEGORIES.length)}`}
        </span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {COSMETIC_CATEGORIES.map((category) => {
          const equipped = cosmetics?.[category];
          const item = getCosmeticItem(equipped?.item_id);

          return (
            <li
              className={cn(
                'flex items-center gap-3 rounded-xl border px-3 py-2',
                item ? 'border-white/[0.1] bg-white/[0.05]' : 'border-white/[0.06] bg-white/[0.02]',
              )}
              key={category}>
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
                style={{
                  backgroundColor: item ? `${item.accent}1f` : 'rgba(255,255,255,0.03)',
                  borderColor: item ? `${item.accent}66` : 'rgba(255,255,255,0.10)',
                }}>
                {item ? (
                  <CosmeticIcon color={item.accent} name={item.icon} size={15} />
                ) : (
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-white/25" />
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[10px] font-black uppercase tracking-[1.2px] text-white/45">
                  {COSMETIC_CATEGORY_LABELS[category]}
                </span>
                <span
                  className={cn(
                    'block truncate text-sm font-bold',
                    item ? 'text-white' : 'text-white/40',
                  )}>
                  {item ? item.name : 'Nothing equipped'}
                </span>
              </span>
            </li>
          );
        })}
      </ul>

      <Link
        className="flex items-center justify-between gap-2 rounded-xl border border-electric-green/30 bg-electric-green/[0.08] px-3 py-2.5 transition duration-150 ease-arena hover:bg-electric-green/[0.14]"
        to={ROUTES.shop}>
        <span className="flex items-center gap-2">
          <Store aria-hidden className="h-4 w-4 text-electric-green" />
          <span className="text-sm font-black uppercase tracking-[0.09em] text-electric-green">
            Open the Shop
          </span>
        </span>
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-electric-green" />
      </Link>
    </Card>
  );
}
