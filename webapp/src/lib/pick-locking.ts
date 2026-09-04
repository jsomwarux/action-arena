export type LockableBetLeg = {
  game_start_time: string;
  locked: boolean;
};

export type LockablePick = {
  bet_legs: LockableBetLeg[];
};

export function isBetLegLocked(leg: LockableBetLeg, now = Date.now()) {
  return leg.locked || new Date(leg.game_start_time).getTime() <= now;
}

export function isParentPickLocked(pick: LockablePick, now = Date.now()) {
  return pick.bet_legs.some((leg) => isBetLegLocked(leg, now));
}
