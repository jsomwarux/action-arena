import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

import {
  RELEASE_PASSWORD,
  releaseManifest,
  releaseUsers,
} from "./release-fixture-manifest.mjs";
import {
  canonicalRoot,
  localStatus,
  psqlFile,
} from "./lib/local-supabase.mjs";

function outputPath() {
  const index = process.argv.indexOf("--output");
  if (index < 0) {
    return path.join(
      canonicalRoot,
      "supabase",
      ".temp",
      "release-fixtures.json",
    );
  }
  const candidate = process.argv[index + 1];
  if (!candidate) throw new Error("--output requires a file path.");
  return path.resolve(process.cwd(), candidate);
}

const status = localStatus();
const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const fixtureEmails = new Set(
  Object.values(releaseUsers).map((user) => user.email),
);
const existing = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (existing.error) throw existing.error;
for (const user of existing.data.users) {
  if (user.email && fixtureEmails.has(user.email)) {
    const removed = await admin.auth.admin.deleteUser(user.id);
    if (removed.error) throw removed.error;
  }
}

for (const user of Object.values(releaseUsers)) {
  const created = await admin.auth.admin.createUser({
    email: user.email,
    email_confirm: true,
    id: user.id,
    password: RELEASE_PASSWORD,
    user_metadata: {
      action_arena_disclosure_seen_at: "2026-07-01T12:00:00.000Z",
      display_name: user.displayName,
    },
  });
  if (created.error) throw created.error;
}

const fixtureSql = path.join(canonicalRoot, "scripts", "release-fixtures.sql");
const sqlOutput = psqlFile(fixtureSql);
if (!sqlOutput.includes("release fixtures seeded")) {
  throw new Error(`Fixture SQL did not confirm completion:\n${sqlOutput}`);
}

const manifestPath = outputPath();
mkdirSync(path.dirname(manifestPath), { recursive: true });
writeFileSync(
  manifestPath,
  `${JSON.stringify(releaseManifest(status), null, 2)}\n`,
  { mode: 0o600 },
);

execFileSync("chmod", ["600", manifestPath]);
console.log(`Release fixtures: ${manifestPath}`);
