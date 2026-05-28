import type { ComponentProps } from 'react';

import Ionicons from '@expo/vector-icons/Ionicons';

import { THEME_COLORS } from './theme';
import type { CosmeticCategory } from '@/types/database';

export type CosmeticItem = {
  accent: string;
  category: CosmeticCategory;
  cost: number;
  description: string;
  id: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  name: string;
  seasonLabel?: string;
  styleKey: string;
};

export type CoinPack = {
  coins: number;
  id: string;
  label: string;
  priceLabel: string;
};

export const DEFAULT_ARENA_COINS = 500;
export const CURRENT_SEASON_YEAR = new Date().getFullYear();

export const COIN_PACKS: CoinPack[] = [
  { coins: 500, id: 'coins_500', label: 'Starter Stack', priceLabel: 'Soon' },
  { coins: 1200, id: 'coins_1200', label: 'Playmaker Pack', priceLabel: 'Soon' },
  { coins: 2800, id: 'coins_2800', label: 'Commissioner Vault', priceLabel: 'Soon' },
];

export const COSMETIC_CATEGORY_LABELS: Record<CosmeticCategory, string> = {
  chat_sticker_pack: 'Chat Stickers',
  lock_effect: 'Lock Effects',
  profile_frame: 'Profile Frames',
  team_logo: 'Team Logos',
  trophy_skin: 'Trophy Skins',
  win_celebration: 'Win Celebrations',
};

export const COSMETIC_CATEGORY_DESCRIPTIONS: Record<CosmeticCategory, string> = {
  chat_sticker_pack: 'Animated sticker packs for league chat.',
  lock_effect: 'Effects that make your Pick of the Week pop.',
  profile_frame: 'Decorative avatar borders across the app.',
  team_logo: 'Custom team identity for profiles, standings, chat, and matchup cards.',
  trophy_skin: 'Alternate trophy treatments for standings and season awards.',
  win_celebration: 'Celebrations when a winning matchup result is viewed.',
};

export const COSMETIC_CATEGORIES: CosmeticCategory[] = [
  'team_logo',
  'trophy_skin',
  'lock_effect',
  'win_celebration',
  'chat_sticker_pack',
  'profile_frame',
];

const green = THEME_COLORS.electricGreen;
const red = THEME_COLORS.coralRed;
const gold = THEME_COLORS.gold;
const amber = THEME_COLORS.amberAccent;
const cyan = THEME_COLORS.cyanAccent;

export const COSMETIC_ITEMS: CosmeticItem[] = [
  { accent: red, category: 'team_logo', cost: 150, description: 'A snarling mascot mark for a loud weekly card.', id: 'logo_gridiron_wolf', icon: 'paw', name: 'Gridiron Wolf', styleKey: 'wolf' },
  { accent: amber, category: 'team_logo', cost: 150, description: 'Fast, sharp, and built for underdog picks.', id: 'logo_blitz_fox', icon: 'flash', name: 'Blitz Fox', styleKey: 'fox' },
  { accent: cyan, category: 'team_logo', cost: 175, description: 'Cold-blooded game management with a frosted edge.', id: 'logo_ice_viper', icon: 'snow', name: 'Ice Viper', styleKey: 'viper' },
  { accent: gold, category: 'team_logo', cost: 200, description: 'A prize-fighter look for top-table teams.', id: 'logo_crown_lion', icon: 'ribbon', name: 'Crown Lion', styleKey: 'lion' },
  { accent: green, category: 'team_logo', cost: 175, description: 'A neon power mark with big-play energy.', id: 'logo_neon_bull', icon: 'radio-button-on', name: 'Neon Bull', styleKey: 'bull' },
  { accent: red, category: 'team_logo', cost: 225, description: 'A chaos-heavy identity for high-variance players.', id: 'logo_chaos_bear', icon: 'warning', name: 'Chaos Bear', styleKey: 'bear' },
  { accent: cyan, category: 'team_logo', cost: 200, description: 'A clean angular mark for math-first managers.', id: 'logo_blue_orbit', icon: 'planet', name: 'Blue Orbit', styleKey: 'orbit' },
  { accent: amber, category: 'team_logo', cost: 150, description: 'Retro arcade energy for meme-friendly teams.', id: 'logo_pixel_tiger', icon: 'game-controller', name: 'Pixel Tiger', styleKey: 'pixel' },
  { accent: green, category: 'team_logo', cost: 225, description: 'A winner-first logo with sharp edges.', id: 'logo_cash_shark', icon: 'medal', name: 'Clutch Crest', styleKey: 'clutch' },
  { accent: gold, category: 'team_logo', cost: 250, description: 'A royal abstract crest for trophy hunters.', id: 'logo_gold_spire', icon: 'triangle', name: 'Gold Spire', styleKey: 'spire' },
  { accent: cyan, category: 'team_logo', cost: 175, description: 'Clean signal bars for steady grinders.', id: 'logo_signal_wave', icon: 'pulse', name: 'Signal Wave', styleKey: 'wave' },
  { accent: red, category: 'team_logo', cost: 275, description: 'A loud hazard badge for fearless picks.', id: 'logo_red_alert', icon: 'megaphone', name: 'Red Alert', styleKey: 'alert' },
  { accent: amber, category: 'team_logo', cost: 200, description: 'A blazing bird crest for comeback weeks.', id: 'logo_fire_hawk', icon: 'flame', name: 'Fire Hawk', styleKey: 'hawk' },
  { accent: green, category: 'team_logo', cost: 150, description: 'A simple lucky mark with bright green shine.', id: 'logo_lucky_bolt', icon: 'sparkles', name: 'Lucky Bolt', styleKey: 'bolt' },
  { accent: cyan, category: 'team_logo', cost: 225, description: 'A slick cyber mark for totals specialists.', id: 'logo_cyber_ram', icon: 'hardware-chip', name: 'Cyber Ram', styleKey: 'ram' },
  { accent: gold, category: 'team_logo', cost: 300, description: 'A championship-ready crest with trophy weight.', id: 'logo_trophy_ape', icon: 'trophy', name: 'Trophy Ape', styleKey: 'ape' },
  { accent: red, category: 'team_logo', cost: 200, description: 'A spicy meme badge for high-emotion weeks.', id: 'logo_salty_goat', icon: 'happy', name: 'Salty Goat', styleKey: 'goat' },
  { accent: amber, category: 'team_logo', cost: 250, description: 'A scoreboard-themed badge for weekly score runs.', id: 'logo_money_press', icon: 'print', name: 'Score Press', styleKey: 'press' },
  { accent: green, category: 'team_logo', cost: 175, description: 'A clean clover mark for parlay dreamers.', id: 'logo_four_leaf', icon: 'leaf', name: 'Four Leaf', styleKey: 'leaf' },
  { accent: cyan, category: 'team_logo', cost: 225, description: 'A sharp moon crest for late-window hunters.', id: 'logo_midnight_moon', icon: 'moon', name: 'Midnight Moon', styleKey: 'moon' },
  { accent: red, category: 'team_logo', cost: 250, description: 'A hot-take badge for fearless trash talk.', id: 'logo_take_volcano', icon: 'flame-outline', name: 'Take Volcano', styleKey: 'volcano' },
  { accent: gold, category: 'team_logo', cost: 275, description: 'A bold abstract ring for league villains.', id: 'logo_halo_zero', icon: 'ellipse', name: 'Halo Zero', styleKey: 'halo' },
  { accent: green, category: 'team_logo', cost: 200, description: 'A laser-eyed logo for the Sunday slate.', id: 'logo_laser_cat', icon: 'scan', name: 'Laser Cat', styleKey: 'laser' },
  { accent: cyan, category: 'team_logo', cost: 300, description: 'A premium frozen crown team mark.', id: 'logo_arctic_crown', icon: 'diamond', name: 'Arctic Crown', styleKey: 'arctic' },

  { accent: gold, category: 'trophy_skin', cost: 200, description: 'A clean gold upgrade from the standard trophy.', id: 'trophy_golden_crown', icon: 'trophy', name: 'Golden Crown', styleKey: 'crown' },
  { accent: cyan, category: 'trophy_skin', cost: 350, description: 'A glassy diamond cup for elite seasons.', id: 'trophy_diamond', icon: 'diamond', name: 'Diamond Cup', styleKey: 'diamond' },
  { accent: red, category: 'trophy_skin', cost: 400, description: 'A flaming skull-inspired trophy skin.', id: 'trophy_flaming_skull', icon: 'flame', name: 'Flaming Skull', styleKey: 'flame' },
  { accent: green, category: 'trophy_skin', cost: 500, description: 'A loud scoreboard championship skin.', id: 'trophy_money_printer', icon: 'podium', name: 'Scoreboard Glow', styleKey: 'scoreboard' },

  { accent: red, category: 'lock_effect', cost: 150, description: 'Fire accents for the weekly pick you believe in most.', id: 'lock_fire', icon: 'flame', name: 'Animated Fire', styleKey: 'fire' },
  { accent: gold, category: 'lock_effect', cost: 200, description: 'A quick lightning strike around Pick of the Week cards.', id: 'lock_lightning', icon: 'flash', name: 'Lightning Bolt', styleKey: 'lightning' },
  { accent: cyan, category: 'lock_effect', cost: 225, description: 'Frosted edges and icy glow on Pick of the Week picks.', id: 'lock_frost', icon: 'snow', name: 'Ice/Frost', styleKey: 'frost' },
  { accent: green, category: 'lock_effect', cost: 300, description: 'A bright neon pulse for premium confidence.', id: 'lock_neon', icon: 'sparkles', name: 'Neon Glow', styleKey: 'neon' },

  { accent: green, category: 'win_celebration', cost: 200, description: 'A punchy scoreboard-number burst after a winning matchup.', id: 'celebration_money_rain', icon: 'stats-chart', name: 'Score Burst', styleKey: 'score' },
  { accent: amber, category: 'win_celebration', cost: 250, description: 'A stadium crowd burst with gold noise.', id: 'celebration_crowd', icon: 'people', name: 'Stadium Crowd', styleKey: 'crowd' },
  { accent: gold, category: 'win_celebration', cost: 400, description: 'A full fireworks-style victory burst.', id: 'celebration_fireworks', icon: 'sparkles', name: 'Fireworks', styleKey: 'fireworks' },

  { accent: amber, category: 'chat_sticker_pack', cost: 100, description: 'Trash-talk staples for league chat.', id: 'stickers_talk_trash', icon: 'chatbubble-ellipses', name: 'Talk Trash Pack', styleKey: 'trash' },
  { accent: green, category: 'chat_sticker_pack', cost: 150, description: 'Scoreboard reactions for big hits.', id: 'stickers_winner', icon: 'medal', name: 'Winner Pack', styleKey: 'winner' },
  { accent: cyan, category: 'chat_sticker_pack', cost: 150, description: 'Live-game reactions for close finishes.', id: 'stickers_sweat', icon: 'water', name: 'Live Game Pack', styleKey: 'live' },
  { accent: gold, category: 'chat_sticker_pack', cost: 200, description: 'Trophy and flex stickers for weekly awards.', id: 'stickers_trophy_flex', icon: 'trophy', name: 'Trophy Flex Pack', styleKey: 'trophy' },

  { accent: green, category: 'profile_frame', cost: 100, description: 'A bright green border for everyday league play.', id: 'frame_electric', icon: 'square-outline', name: 'Electric Frame', styleKey: 'electric' },
  { accent: amber, category: 'profile_frame', cost: 150, description: 'Amber glow for parlay-forward profiles.', id: 'frame_amber', icon: 'square-outline', name: 'Amber Frame', styleKey: 'amber' },
  { accent: cyan, category: 'profile_frame', cost: 175, description: 'Cyan edgework for teaser specialists.', id: 'frame_cyan', icon: 'square-outline', name: 'Cyan Frame', styleKey: 'cyan' },
  { accent: gold, category: 'profile_frame', cost: 250, description: 'A gold frame for top-table flexing.', id: 'frame_gold', icon: 'square-outline', name: 'Gold Frame', styleKey: 'gold' },
];

const FOUNDER_SEASON_LABEL = `Season ${CURRENT_SEASON_YEAR} Exclusive`;

export const SEASON_PASS_COSMETICS: CosmeticItem[] = [
  { accent: gold, category: 'team_logo', cost: 0, description: 'Founder team logo for the inaugural pass class.', id: 's1_logo_founder', icon: 'star', name: 'Founder Star', seasonLabel: FOUNDER_SEASON_LABEL, styleKey: 'founder' },
  { accent: cyan, category: 'profile_frame', cost: 0, description: 'Animated profile frame for pass holders.', id: 's1_frame_champion', icon: 'ribbon', name: 'Champion Frame', seasonLabel: FOUNDER_SEASON_LABEL, styleKey: 's1_champion' },
  { accent: red, category: 'lock_effect', cost: 0, description: 'Overdrive Lock treatment for founders.', id: 's1_lock_overdrive', icon: 'flash', name: 'Lock Overdrive', seasonLabel: FOUNDER_SEASON_LABEL, styleKey: 'overdrive' },
  { accent: gold, category: 'trophy_skin', cost: 0, description: 'Legacy trophy skin for founders.', id: 's1_trophy_legacy', icon: 'trophy', name: 'Legacy Trophy', seasonLabel: FOUNDER_SEASON_LABEL, styleKey: 'legacy' },
];

export const ALL_COSMETIC_ITEMS = [...COSMETIC_ITEMS, ...SEASON_PASS_COSMETICS];

export function getCosmeticItem(itemId: string | null | undefined) {
  if (!itemId) return null;
  return ALL_COSMETIC_ITEMS.find((item) => item.id === itemId) ?? null;
}

export function getItemsByCategory(category: CosmeticCategory) {
  return ALL_COSMETIC_ITEMS.filter((item) => item.category === category);
}
