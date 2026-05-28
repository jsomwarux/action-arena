import { formatCurrency } from '@/lib/format';

export type MatchupSideStatus = 'leading' | 'trailing' | 'won' | 'lost' | null;

export function getMatchupSideStatus({
  opposingProfit,
  sideProfit,
  sideUserId,
  winnerId,
}: {
  opposingProfit: number;
  sideProfit: number;
  sideUserId: string | null;
  winnerId: string | null;
}): MatchupSideStatus {
  if (winnerId) {
    return winnerId === sideUserId ? 'won' : 'lost';
  }

  if (sideProfit > opposingProfit) {
    return 'leading';
  }

  if (sideProfit < opposingProfit) {
    return 'trailing';
  }

  return null;
}

export function getProfitSwingHeadline({
  awayName,
  awayProfit,
  awayUserId,
  homeName,
  homeProfit,
  homeUserId,
  winnerId,
}: {
  awayName: string;
  awayProfit: number;
  awayUserId: string | null;
  homeName: string;
  homeProfit: number;
  homeUserId: string;
  winnerId: string | null;
}) {
  const diff = homeProfit - awayProfit;
  const winnerName =
    winnerId === homeUserId ? homeName : winnerId && winnerId === awayUserId ? awayName : null;
  const leader = winnerName ?? (diff > 0 ? homeName : diff < 0 ? awayName : null);

  if (!leader) {
    return 'Dead even';
  }

  return `${leader} ${winnerId ? 'won by' : 'leads by'} ${formatCurrency(Math.abs(diff))}`;
}
