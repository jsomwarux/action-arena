export type NflTeamData = {
  abbreviation: string;
  logoUrl: string;
  primaryColor: string;
  shortName: string;
};

type NflTeamSourceData = Omit<NflTeamData, 'logoUrl'> & {
  aliases?: string[];
  logoSlug: string;
};

const NFL_LOGO_BASE_URL =
  'https://static.www.nfl.com/t_q-best/league/api/clubs/logos';

const NFL_TEAMS_BY_FULL_NAME: Record<string, NflTeamSourceData> = {
  'Arizona Cardinals': {
    abbreviation: 'ARI',
    logoSlug: 'ARI',
    primaryColor: '#97233F',
    shortName: 'Cardinals',
  },
  'Atlanta Falcons': {
    abbreviation: 'ATL',
    logoSlug: 'ATL',
    primaryColor: '#A71930',
    shortName: 'Falcons',
  },
  'Baltimore Ravens': {
    abbreviation: 'BAL',
    logoSlug: 'BAL',
    primaryColor: '#241773',
    shortName: 'Ravens',
  },
  'Buffalo Bills': {
    abbreviation: 'BUF',
    logoSlug: 'BUF',
    primaryColor: '#00338D',
    shortName: 'Bills',
  },
  'Carolina Panthers': {
    abbreviation: 'CAR',
    logoSlug: 'CAR',
    primaryColor: '#0085CA',
    shortName: 'Panthers',
  },
  'Chicago Bears': {
    abbreviation: 'CHI',
    logoSlug: 'CHI',
    primaryColor: '#0B162A',
    shortName: 'Bears',
  },
  'Cincinnati Bengals': {
    abbreviation: 'CIN',
    logoSlug: 'CIN',
    primaryColor: '#FB4F14',
    shortName: 'Bengals',
  },
  'Cleveland Browns': {
    abbreviation: 'CLE',
    logoSlug: 'CLE',
    primaryColor: '#FF3C00',
    shortName: 'Browns',
  },
  'Dallas Cowboys': {
    abbreviation: 'DAL',
    logoSlug: 'DAL',
    primaryColor: '#003594',
    shortName: 'Cowboys',
  },
  'Denver Broncos': {
    abbreviation: 'DEN',
    logoSlug: 'DEN',
    primaryColor: '#FB4F14',
    shortName: 'Broncos',
  },
  'Detroit Lions': {
    abbreviation: 'DET',
    logoSlug: 'DET',
    primaryColor: '#0076B6',
    shortName: 'Lions',
  },
  'Green Bay Packers': {
    abbreviation: 'GB',
    logoSlug: 'GB',
    primaryColor: '#203731',
    shortName: 'Packers',
  },
  'Houston Texans': {
    abbreviation: 'HOU',
    logoSlug: 'HOU',
    primaryColor: '#03202F',
    shortName: 'Texans',
  },
  'Indianapolis Colts': {
    abbreviation: 'IND',
    logoSlug: 'IND',
    primaryColor: '#002C5F',
    shortName: 'Colts',
  },
  'Jacksonville Jaguars': {
    abbreviation: 'JAX',
    logoSlug: 'JAX',
    primaryColor: '#006778',
    shortName: 'Jaguars',
  },
  'Kansas City Chiefs': {
    abbreviation: 'KC',
    logoSlug: 'KC',
    primaryColor: '#E31837',
    shortName: 'Chiefs',
  },
  'Las Vegas Raiders': {
    abbreviation: 'LV',
    logoSlug: 'LV',
    primaryColor: '#000000',
    shortName: 'Raiders',
  },
  'Los Angeles Chargers': {
    abbreviation: 'LAC',
    logoSlug: 'LAC',
    primaryColor: '#0080C6',
    shortName: 'Chargers',
  },
  'Los Angeles Rams': {
    abbreviation: 'LAR',
    aliases: ['LA Rams'],
    logoSlug: 'LAR',
    primaryColor: '#003594',
    shortName: 'Rams',
  },
  'Miami Dolphins': {
    abbreviation: 'MIA',
    logoSlug: 'MIA',
    primaryColor: '#008E97',
    shortName: 'Dolphins',
  },
  'Minnesota Vikings': {
    abbreviation: 'MIN',
    logoSlug: 'MIN',
    primaryColor: '#4F2683',
    shortName: 'Vikings',
  },
  'New England Patriots': {
    abbreviation: 'NE',
    logoSlug: 'NE',
    primaryColor: '#002244',
    shortName: 'Patriots',
  },
  'New Orleans Saints': {
    abbreviation: 'NO',
    logoSlug: 'NO',
    primaryColor: '#D3BC8D',
    shortName: 'Saints',
  },
  'New York Giants': {
    abbreviation: 'NYG',
    logoSlug: 'NYG',
    primaryColor: '#0B2265',
    shortName: 'Giants',
  },
  'New York Jets': {
    abbreviation: 'NYJ',
    logoSlug: 'NYJ',
    primaryColor: '#125740',
    shortName: 'Jets',
  },
  'Philadelphia Eagles': {
    abbreviation: 'PHI',
    logoSlug: 'PHI',
    primaryColor: '#004C54',
    shortName: 'Eagles',
  },
  'Pittsburgh Steelers': {
    abbreviation: 'PIT',
    logoSlug: 'PIT',
    primaryColor: '#FFB612',
    shortName: 'Steelers',
  },
  'San Francisco 49ers': {
    abbreviation: 'SF',
    logoSlug: 'SF',
    primaryColor: '#AA0000',
    shortName: '49ers',
  },
  'Seattle Seahawks': {
    abbreviation: 'SEA',
    logoSlug: 'SEA',
    primaryColor: '#002244',
    shortName: 'Seahawks',
  },
  'Tampa Bay Buccaneers': {
    abbreviation: 'TB',
    logoSlug: 'TB',
    primaryColor: '#D50A0A',
    shortName: 'Buccaneers',
  },
  'Tennessee Titans': {
    abbreviation: 'TEN',
    logoSlug: 'TEN',
    primaryColor: '#0C2340',
    shortName: 'Titans',
  },
  'Washington Commanders': {
    abbreviation: 'WAS',
    aliases: ['WSH'],
    logoSlug: 'WAS',
    primaryColor: '#5A1414',
    shortName: 'Commanders',
  },
};

function withLogoUrl(team: NflTeamSourceData): NflTeamData {
  return {
    abbreviation: team.abbreviation,
    logoUrl: `${NFL_LOGO_BASE_URL}/${team.logoSlug}.png`,
    primaryColor: team.primaryColor,
    shortName: team.shortName,
  };
}

function normalizeLookupKey(value: string) {
  return value.trim().toLowerCase();
}

const NFL_TEAM_DATA_BY_FULL_NAME = Object.fromEntries(
  Object.entries(NFL_TEAMS_BY_FULL_NAME).map(([fullName, team]) => [
    fullName,
    withLogoUrl(team),
  ]),
) as Record<string, NflTeamData>;

const NFL_TEAM_DATA_BY_SHORT_NAME = Object.fromEntries(
  Object.values(NFL_TEAM_DATA_BY_FULL_NAME).map((team) => [
    normalizeLookupKey(team.shortName),
    team,
  ]),
) as Record<string, NflTeamData>;

const NFL_TEAM_DATA_BY_ALIAS = Object.fromEntries(
  Object.entries(NFL_TEAMS_BY_FULL_NAME).flatMap(([fullName, sourceTeam]) => {
    const team = NFL_TEAM_DATA_BY_FULL_NAME[fullName];
    const aliases = [sourceTeam.abbreviation, ...(sourceTeam.aliases ?? [])];
    return aliases.map((alias) => [normalizeLookupKey(alias), team]);
  }),
) as Record<string, NflTeamData>;

export function getNflTeamShortName(teamName: string) {
  return (
    resolveNflTeamData(teamName)?.shortName ??
    teamName.split(' ').at(-1) ??
    teamName
  );
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
  const lookupKey = normalizeLookupKey(normalized);
  if (NFL_TEAM_DATA_BY_FULL_NAME[normalized])
    return NFL_TEAM_DATA_BY_FULL_NAME[normalized];
  if (NFL_TEAM_DATA_BY_SHORT_NAME[lookupKey])
    return NFL_TEAM_DATA_BY_SHORT_NAME[lookupKey];
  if (NFL_TEAM_DATA_BY_ALIAS[lookupKey])
    return NFL_TEAM_DATA_BY_ALIAS[lookupKey];

  return Object.entries(NFL_TEAM_DATA_BY_FULL_NAME).find(
    ([fullName, team]) =>
      lookupKey.includes(normalizeLookupKey(fullName)) ||
      lookupKey.includes(normalizeLookupKey(team.shortName)),
  )?.[1];
}
