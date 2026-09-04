import {
  Activity,
  Award,
  BarChart3,
  Check,
  ChevronRight,
  Circle,
  CircleDot,
  Cpu,
  Diamond,
  Droplets,
  Flame,
  Gamepad2,
  Leaf,
  Lock,
  Medal,
  Megaphone,
  MessageCircleMore,
  Moon,
  Orbit,
  PawPrint,
  Printer,
  Radio,
  Ribbon,
  Scan,
  Smile,
  Snowflake,
  Sparkles,
  Square,
  Star,
  Triangle,
  TriangleAlert,
  Trophy,
  User,
  Users,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/**
 * Ionicons glyph name -> lucide component.
 *
 * The cosmetic catalog is shared with mobile and stores Ionicons names in
 * `constants/cosmetics.ts` (and, for owned rows, nothing at all — the name is
 * always looked up from the catalog). Rather than fork the catalog for the web,
 * the names are translated here, so a cosmetic added on mobile only needs a row
 * in this map to render on the web with the same identity.
 */
const IONICON_TO_LUCIDE: Record<string, LucideIcon> = {
  'chatbubble-ellipses': MessageCircleMore,
  checkmark: Check,
  'chevron-forward': ChevronRight,
  close: X,
  diamond: Diamond,
  ellipse: Circle,
  'ellipse-outline': Circle,
  flame: Flame,
  'flame-outline': Flame,
  flash: Zap,
  'game-controller': Gamepad2,
  happy: Smile,
  'hardware-chip': Cpu,
  leaf: Leaf,
  'lock-closed': Lock,
  medal: Medal,
  megaphone: Megaphone,
  moon: Moon,
  paw: PawPrint,
  people: Users,
  person: User,
  planet: Orbit,
  podium: BarChart3,
  print: Printer,
  pulse: Activity,
  radio: Radio,
  'radio-button-on': CircleDot,
  ribbon: Ribbon,
  scan: Scan,
  snow: Snowflake,
  sparkles: Sparkles,
  square: Square,
  'square-outline': Square,
  star: Star,
  'star-outline': Star,
  'stats-chart': BarChart3,
  triangle: Triangle,
  trophy: Trophy,
  warning: TriangleAlert,
  water: Droplets,
};

export function getCosmeticIconComponent(name: string | null | undefined): LucideIcon {
  if (!name) {
    return Award;
  }

  return IONICON_TO_LUCIDE[name] ?? Award;
}

export type CosmeticIconProps = {
  className?: string;
  color?: string;
  /** Ionicons glyph name, exactly as stored on the cosmetic catalog item. */
  name: string | null | undefined;
  /** Pixel size, matching the mobile `size` prop on <Ionicons />. */
  size?: number;
  strokeWidth?: number;
};

/**
 * Renders a catalog item's glyph. Kept deliberately thin so every cosmetic
 * surface (avatars, previews, shop, chat) draws its icon exactly one way.
 */
export function CosmeticIcon({
  className,
  color,
  name,
  size = 20,
  strokeWidth = 2.25,
}: CosmeticIconProps) {
  const Icon = getCosmeticIconComponent(name);

  return (
    <Icon
      aria-hidden
      className={className}
      color={color}
      size={size}
      strokeWidth={strokeWidth}
    />
  );
}
