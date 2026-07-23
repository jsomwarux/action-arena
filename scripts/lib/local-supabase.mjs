import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const canonicalRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

export const supabaseBinary = path.join(
  canonicalRoot,
  "node_modules",
  ".bin",
  "supabase",
);

export function localStatus() {
  const output = execFileSync(supabaseBinary, ["status", "-o", "json"], {
    cwd: canonicalRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const start = output.indexOf("{");
  const end = output.lastIndexOf("}");
  if (start < 0 || end < start) {
    throw new Error("Supabase status did not return JSON.");
  }
  const status = JSON.parse(output.slice(start, end + 1));
  assertLoopback("API_URL", status.API_URL);
  assertLoopback("DB_URL", status.DB_URL);
  if (!status.SERVICE_ROLE_KEY || !status.ANON_KEY) {
    throw new Error("The local Supabase stack did not expose test keys.");
  }
  return status;
}

function assertLoopback(name, value) {
  if (typeof value !== "string") {
    throw new Error(`Missing ${name} from local Supabase status.`);
  }
  const host = new URL(value).hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(
      `Refusing to run release verification against non-local ${name}: ${value}`,
    );
  }
}

export function psqlFile(file) {
  localStatus();
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      "supabase_db_ACTION_ARENA",
      "psql",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    {
      cwd: canonicalRoot,
      encoding: "utf8",
      input: readFileSync(file, "utf8"),
      maxBuffer: 16 * 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
}
