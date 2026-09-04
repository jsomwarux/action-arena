import {
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  Circle,
  CircleDot,
  Cpu,
  Diamond,
  Droplet,
  Flame,
  Gamepad2,
  Globe,
  Leaf,
  Medal,
  Megaphone,
  MessageCircle,
  Moon,
  PawPrint,
  Printer,
  Scan,
  Smile,
  Snowflake,
  Sparkles,
  Square,
  Star,
  Triangle,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import { getCosmeticItem } from '@/constants/cosmetics';
import { cn } from '@/lib/cn';
import type { EquippedCosmeticsByCategory } from '@/types/database';

/**
 * Web stand-in for components/cosmetics/index.tsx.
 *
 * The catalogue in src/constants/cosmetics.ts still stores Ionicons glyph names
 * — it is a straight port of the mobile file, and the ids are what the database
 * holds. This table is the only place the web app translates one of those names
 * into the lucide icon it draws instead; anything unmapped falls back to a
 * sparkle rather than rendering nothing.
 */
const ICON_BY_IONICON: Record<string, LucideIcon> = {
  'chatbubble-ellipses': MessageCircle,
  diamond: Diamond,
  ellipse: Circle,
  flame: Flame,
  'flame-outline': Flame,
  flash: Zap,
  'game-controller': Gamepad2,
  happy: Smile,
  'hardware-chip': Cpu,
  leaf: Leaf,
  medal: Medal,
  megaphone: Megaphone,
  moon: Moon,
  paw: PawPrint,
  people: Users,
  planet: Globe,
  podium: BarChart3,
  print: Printer,
  pulse: Activity,
  'radio-button-on': CircleDot,
  ribbon: Award,
  scan: Scan,
  snow: Snowflake,
  sparkles: Sparkles,
  'square-outline': Square,
  star: Star,
  'stats-chart': BarChart3,
  triangle: Triangle,
  trophy: Trophy,
  warning: AlertTriangle,
  water: Droplet,
};

export function cosmeticIcon(iconName: string | undefined): LucideIcon {
  return (iconName && ICON_BY_IONICON[iconName]) || Sparkles;
}

function itemFor(
  cosmetics: EquippedCosmeticsByCategory | null | undefined,
  category: 'profile_frame' | 'team_logo' | 'trophy_skin',
) {
  const row = cosmetics?.[category];
  return row ? getCosmeticItem(row.item_id) : null;
}

function initialsFor(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? '')
    .join('');
}

export type AvatarSize = 'lg' | 'md' | 'sm';

const AVATAR_SIZES: Record<AvatarSize, { box: string; icon: string; text: string }> = {
  lg: { box: 'h-16 w-16 rounded-3xl', icon: 'h-7 w-7', text: 'text-lg' },
  md: { box: 'h-11 w-11 rounded-2xl', icon: 'h-5 w-5', text: 'text-sm' },
  sm: { box: 'h-8 w-8 rounded-xl', icon: 'h-4 w-4', text: 'text-[11px]' },
};

/**
 * Port of CosmeticAvatar: equipped team logo if there is one, initials if not,
 * with the equipped profile frame supplying the ring colour and glow.
 *
 * The mobile version pulses that ring with an Animated loop. Here the ring is a
 * static border — the avatar reads the same at rest, which is the state that has
 * to be legible.
 */
export function CosmeticAvatar({
  cosmetics,
  name,
  size = 'md',
}: {
  cosmetics?: EquippedCosmeticsByCategory | null;
  name: string;
  size?: AvatarSize;
}) {
  const logo = itemFor(cosmetics, 'team_logo');
  const frame = itemFor(cosmetics, 'profile_frame');
  const sizes = AVATAR_SIZES[size];
  const accent = frame?.accent ?? logo?.accent ?? null;
  const LogoIcon = logo ? cosmeticIcon(logo.icon) : null;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center border bg-white/[0.04]',
        sizes.box,
        frame ? 'border-2' : 'border-white/12',
      )}
      style={
        frame && accent ? { borderColor: accent, boxShadow: `0 0 12px ${accent}55` } : undefined
      }>
      {LogoIcon && logo ? (
        <LogoIcon aria-hidden className={sizes.icon} style={{ color: logo.accent }} />
      ) : (
        <span className={cn('font-black uppercase tracking-[0.04em] text-white/80', sizes.text)}>
          {initialsFor(name) || '?'}
        </span>
      )}
    </span>
  );
}

/** Port of TrophySkinIcon — the rank-1 marker in standings. */
export function TrophySkinIcon({
  className,
  cosmetics,
}: {
  className?: string;
  cosmetics?: EquippedCosmeticsByCategory | null;
}) {
  const trophy = itemFor(cosmetics, 'trophy_skin');
  const Icon = trophy ? cosmeticIcon(trophy.icon) : Trophy;

  return (
    <Icon
      aria-hidden
      className={cn('h-4 w-4', className)}
      style={trophy ? { color: trophy.accent } : undefined}
    />
  );
}

/** Port of ChatStickerPreview: the accent-tinted tile a sticker message shows. */
export function ChatStickerPreview({ itemId, size = 'md' }: { itemId: string; size?: 'md' | 'sm' }) {
  const item = getCosmeticItem(itemId);

  if (!item) {
    return null;
  }

  const Icon = cosmeticIcon(item.icon);

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center border',
        size === 'sm' ? 'h-10 w-10 rounded-2xl' : 'h-16 w-16 rounded-3xl',
      )}
      style={{ backgroundColor: `${item.accent}22`, borderColor: `${item.accent}77` }}>
      <Icon
        aria-hidden
        className={size === 'sm' ? 'h-[18px] w-[18px]' : 'h-7 w-7'}
        style={{ color: item.accent }}
      />
    </span>
  );
}
