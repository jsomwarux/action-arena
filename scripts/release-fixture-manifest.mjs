export const RELEASE_PASSWORD = "ArenaRelease!2026";

export const releaseUsers = {
  blocked: {
    displayName: "Blocked Fixture",
    email: "release.blocked@actionarena.test",
    id: "10000000-0000-0000-0000-000000000011",
  },
  commissioner: {
    displayName: "Release Commissioner",
    email: "release.commissioner@actionarena.test",
    id: "10000000-0000-0000-0000-000000000003",
  },
  deleteCommissioner: {
    displayName: "Delete Commissioner",
    email: "release.delete.commissioner@actionarena.test",
    id: "10000000-0000-0000-0000-000000000006",
  },
  deleteMember: {
    displayName: "Delete Member",
    email: "release.delete.member@actionarena.test",
    id: "10000000-0000-0000-0000-000000000005",
  },
  deleteOnlyMember: {
    displayName: "Delete Only Member",
    email: "release.delete.only@actionarena.test",
    id: "10000000-0000-0000-0000-000000000007",
  },
  joiner: {
    displayName: "Release Joiner",
    email: "release.joiner@actionarena.test",
    id: "10000000-0000-0000-0000-000000000010",
  },
  nonmember: {
    displayName: "Release Nonmember",
    email: "release.nonmember@actionarena.test",
    id: "10000000-0000-0000-0000-000000000004",
  },
  recovery: {
    displayName: "Recovery Fixture",
    email: "release.recovery@actionarena.test",
    id: "10000000-0000-0000-0000-000000000008",
  },
  sqlEight: {
    displayName: "SQL Fixture Eight",
    email: "release.sql.eight@actionarena.test",
    id: "10000000-0000-0000-0000-000000000012",
  },
  submitter: {
    displayName: "Release Submitter",
    email: "release.submitter@actionarena.test",
    id: "10000000-0000-0000-0000-000000000009",
  },
  userOne: {
    displayName: "Release User One",
    email: "release.user.one@actionarena.test",
    id: "10000000-0000-0000-0000-000000000001",
  },
  userTwo: {
    displayName: "Release User Two",
    email: "release.user.two@actionarena.test",
    id: "10000000-0000-0000-0000-000000000002",
  },
};

export const releaseLeagues = {
  chat: "20000000-0000-0000-0000-000000000008",
  commissionerActions: "20000000-0000-0000-0000-000000000013",
  cumulativePublic: "20000000-0000-0000-0000-000000000015",
  deletionCommissioner: "20000000-0000-0000-0000-000000000010",
  deletionMember: "20000000-0000-0000-0000-000000000009",
  deletionOnlyMember: "20000000-0000-0000-0000-000000000011",
  editable: "20000000-0000-0000-0000-000000000004",
  partiallyLocked: "20000000-0000-0000-0000-000000000005",
  privateInvite: "20000000-0000-0000-0000-000000000002",
  publicDiscovery: "20000000-0000-0000-0000-000000000001",
  realtime: "20000000-0000-0000-0000-000000000014",
  revealed: "20000000-0000-0000-0000-000000000006",
  settled: "20000000-0000-0000-0000-000000000007",
  submit: "20000000-0000-0000-0000-000000000012",
  unsubmitted: "20000000-0000-0000-0000-000000000003",
};

export const releaseEntities = {
  chatMessage: "80000000-0000-0000-0000-000000000001",
  partialParentBet: "30000000-0000-0000-0000-000000000501",
};

export const releaseMatchups = {
  partiallyLocked: "50000000-0000-0000-0000-000000000005",
  revealed: "50000000-0000-0000-0000-000000000006",
  settled: "50000000-0000-0000-0000-000000000007",
};

export function releaseManifest(status) {
  const users = Object.fromEntries(
    Object.entries(releaseUsers).map(([key, user]) => [
      key,
      { ...user, password: RELEASE_PASSWORD },
    ]),
  );

  return {
    generatedAt: new Date().toISOString(),
    leagues: releaseLeagues,
    entities: releaseEntities,
    localSupabase: {
      anonKey: status.ANON_KEY,
      apiUrl: status.API_URL,
      publishableKey: status.PUBLISHABLE_KEY,
      serviceRoleKey: status.SERVICE_ROLE_KEY,
    },
    matchups: releaseMatchups,
    seasonPassCode: "RELEASE-PASS",
    users,
  };
}
