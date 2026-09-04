// NFL team palette for placeholder monogram crests (no licensed logos).
// Lifted verbatim from the prototype's pick-cards.jsx TEAMS map.
// Team names are used for game identification only — see the footer
// disclaimer; Action Arena is not affiliated with the NFL.

export type TeamCode = 'KC' | 'DEN' | 'BUF' | 'MIA' | 'SF' | 'DAL' | 'PHI' | 'GB' | 'BAL' | 'DET';

export interface Team {
  name: string;
  city: string;
  primary: string;
  secondary: string;
}

export const TEAMS: Record<TeamCode, Team> = {
  KC: { name: 'CHIEFS', city: 'KANSAS CITY', primary: '#E31837', secondary: '#FFB81C' },
  DEN: { name: 'BRONCOS', city: 'DENVER', primary: '#FB4F14', secondary: '#002244' },
  BUF: { name: 'BILLS', city: 'BUFFALO', primary: '#00338D', secondary: '#C60C30' },
  MIA: { name: 'DOLPHINS', city: 'MIAMI', primary: '#008E97', secondary: '#FC4C02' },
  SF: { name: '49ERS', city: 'SAN FRANCISCO', primary: '#AA0000', secondary: '#B3995D' },
  DAL: { name: 'COWBOYS', city: 'DALLAS', primary: '#003594', secondary: '#869397' },
  PHI: { name: 'EAGLES', city: 'PHILADELPHIA', primary: '#004C54', secondary: '#A5ACAF' },
  GB: { name: 'PACKERS', city: 'GREEN BAY', primary: '#203731', secondary: '#FFB612' },
  BAL: { name: 'RAVENS', city: 'BALTIMORE', primary: '#241773', secondary: '#9E7C0C' },
  DET: { name: 'LIONS', city: 'DETROIT', primary: '#0076B6', secondary: '#B0B7BC' },
};
