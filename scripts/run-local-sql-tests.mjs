import { readdirSync } from "node:fs";
import path from "node:path";

import {
  canonicalRoot,
  localStatus,
  psqlFile,
} from "./lib/local-supabase.mjs";

localStatus();

const scriptsDirectory = path.join(canonicalRoot, "scripts");
const sqlTests = readdirSync(scriptsDirectory)
  .filter((name) => /^test-.+\.sql$/.test(name))
  .sort();

let failedFiles = 0;
let passedScenarios = 0;
let failedScenarios = 0;
let completedFiles = 0;

for (const name of sqlTests) {
  const file = path.join(scriptsDirectory, name);
  try {
    const output = psqlFile(file);
    const summaries = output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("{") && line.endsWith("}"))
      .flatMap((line) => {
        try {
          const parsed = JSON.parse(line);
          return Number.isInteger(parsed.total) &&
              Number.isInteger(parsed.passed) &&
              Number.isInteger(parsed.failed)
            ? [parsed]
            : [];
        } catch {
          return [];
        }
      });
    const summary = summaries.at(-1);
    if (!summary) {
      throw new Error("No SQL result summary was emitted.");
    }
    passedScenarios += summary.passed;
    failedScenarios += summary.failed;
    if (summary.failed > 0) failedFiles += 1;
    completedFiles += 1;
    console.log(
      `${summary.failed === 0 ? "PASS" : "FAIL"} ${name}: ` +
        `${summary.passed}/${summary.total} scenarios`,
    );
  } catch (error) {
    failedFiles += 1;
    console.error(
      `FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`,
    );
    break;
  }
}

console.log(
  `Canonical SQL totals: ${passedScenarios} passed, ` +
    `${failedScenarios} failed, 0 skipped across ${completedFiles}/${sqlTests.length} completed files.`,
);

if (failedFiles > 0 || failedScenarios > 0) process.exitCode = 1;
