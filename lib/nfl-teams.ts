export type NflTeamData = {
  abbreviation: string;
  logoUrl: string;
  primaryColor: string;
  shortName: string;
};

const ESPN_NFL_LOGO_BASE_URL = 'https://a.espncdn.com/i/teamlogos/nfl/500';

const NFL_TEAMS_BY_FULL_NAME: Record<string, Omit<NflTeamData, 'logoUrl'>> = {
  'Arizona Cardinals': { abbreviation: 'ari', primaryColor: '#97233F', shortName: 'Cardinals' },
  'Atlanta Falcons': { abbreviation: 'atl', primaryColor: '#A71930', shortName: 'Falcons' },
  'Baltimore Ravens': { abbreviation: 'bal', primaryColor: '#241773', shortName: 'Ravens' },
  'Buffalo Bills': { abbreviation: 'buf', primaryColor: '#00338D', shortName: 'Bills' },
  'Carolina Panthers': { abbreviation: 'car', primaryColor: '#0085CA', shortName: 'Panthers' },
  'Chicago Bears': { abbreviation: 'chi', primaryColor: '#0B162A', shortName: 'Bears' },
  'Cincinnati Bengals': { abbreviation: 'cin', primaryColor: '#FB4F14', shortName: 'Bengals' },
  'Cleveland Browns': { abbreviation: 'cle', primaryColor: '#FF3C00', shortName: 'Browns' },
  'Dallas Cowboys': { abbreviation: 'dal', primaryColor: '#003594', shortName: 'Cowboys' },
  'Denver Broncos': { abbreviation: 'den', primaryColor: '#FB4F14', shortName: 'Broncos' },
  'Detroit Lions': { abbreviation: 'det', primaryColor: '#0076B6', shortName: 'Lions' },
  'Green Bay Packers': { abbreviation: 'gb', primaryColor: '#203731', shortName: 'Packers' },
  'Houston Texans': { abbreviation: 'hou', primaryColor: '#03202F', shortName: 'Texans' },
  'Indianapolis Colts': { abbreviation: 'ind', primaryColor: '#002C5F', shortName: 'Colts' },
  'Jacksonville Jaguars': { abbreviation: 'jax', primaryColor: '#006778', shortName: 'Jaguars' },
  'Kansas City Chiefs': { abbreviation: 'kc', primaryColor: '#E31837', shortName: 'Chiefs' },
  'Las Vegas Raiders': { abbreviation: 'lv', primaryColor: '#000000', shortName: 'Raiders' },
  'Los Angeles Chargers': { abbreviation: 'lac', primaryColor: '#0080C6', shortName: 'Chargers' },
  'Los Angeles Rams': { abbreviation: 'lar', primaryColor: '#003594', shortName: 'Rams' },
  'Miami Dolphins': { abbreviation: 'mia', primaryColor: '#008E97', shortName: 'Dolphins' },
  'Minnesota Vikings': { abbreviation: 'min', primaryColor: '#4F2683', shortName: 'Vikings' },
  'New England Patriots': { abbreviation: 'ne', primaryColor: '#002244', shortName: 'Patriots' },
  'New Orleans Saints': { abbreviation: 'no', primaryColor: '#D3BC8D', shortName: 'Saints' },
  'New York Giants': { abbreviation: 'nyg', primaryColor: '#0B2265', shortName: 'Giants' },
  'New York Jets': { abbreviation: 'nyj', primaryColor: '#125740', shortName: 'Jets' },
  'Philadelphia Eagles': { abbreviation: 'phi', primaryColor: '#004C54', shortName: 'Eagles' },
  'Pittsburgh Steelers': { abbreviation: 'pit', primaryColor: '#FFB612', shortName: 'Steelers' },
  'San Francisco 49ers': { abbreviation: 'sf', primaryColor: '#AA0000', shortName: '49ers' },
  'Seattle Seahawks': { abbreviation: 'sea', primaryColor: '#002244', shortName: 'Seahawks' },
  'Tampa Bay Buccaneers': { abbreviation: 'tb', primaryColor: '#D50A0A', shortName: 'Buccaneers' },
  'Tennessee Titans': { abbreviation: 'ten', primaryColor: '#0C2340', shortName: 'Titans' },
  'Washington Commanders': { abbreviation: 'was', primaryColor: '#5A1414', shortName: 'Commanders' },
};

function withLogoUrl(team: Omit<NflTeamData, 'logoUrl'>): NflTeamData {
  return {
    ...team,
    logoUrl: `${ESPN_NFL_LOGO_BASE_URL}/${team.abbreviation}.png`,
  };
}

const NFL_TEAM_DATA_BY_FULL_NAME = Object.fromEntries(
  Object.entries(NFL_TEAMS_BY_FULL_NAME).map(([fullName, team]) => [fullName, withLogoUrl(team)]),
) as Record<string, NflTeamData>;

const NFL_TEAM_DATA_BY_SHORT_NAME = Object.fromEntries(
  Object.values(NFL_TEAM_DATA_BY_FULL_NAME).map((team) => [team.shortName, team]),
) as Record<string, NflTeamData>;

export function getNflTeamShortName(teamName: string) {
  return resolveNflTeamData(teamName)?.shortName ?? teamName.split(' ').at(-1) ?? teamName;
}

export function getNflTeamPrimaryColor(teamShortOrFull: string) {
  return resolveNflTeamData(teamShortOrFull)?.primaryColor ?? '#1F2937';
}

export function getNflTeamLogoUrl(teamShortOrFull: string) {
  return resolveNflTeamData(teamShortOrFull)?.logoUrl;
}

export function resolveNflTeamData(value: string | null | undefined) {
  if (!value) return undefined;

  const normalized = value.trim();
  if (NFL_TEAM_DATA_BY_FULL_NAME[normalized]) return NFL_TEAM_DATA_BY_FULL_NAME[normalized];
  if (NFL_TEAM_DATA_BY_SHORT_NAME[normalized]) return NFL_TEAM_DATA_BY_SHORT_NAME[normalized];

  return Object.entries(NFL_TEAM_DATA_BY_FULL_NAME).find(
    ([fullName, team]) =>
      normalized.includes(fullName) ||
      normalized.includes(team.shortName),
  )?.[1];
}
