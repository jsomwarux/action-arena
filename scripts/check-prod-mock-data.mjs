#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ENV_VAR = 'EXPO_PUBLIC_USE_MOCK_DATA';

function parseEnvFile(filePath) {
  const values = new Map();
  const contents = readFileSync(filePath, 'utf8');

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const exportPrefix = 'export ';
    const normalizedLine = line.startsWith(exportPrefix) ? line.slice(exportPrefix.length).trim() : line;
    const equalsIndex = normalizedLine.indexOf('=');

    if (equalsIndex === -1) {
      continue;
    }

    const key = normalizedLine.slice(0, equalsIndex).trim();
    let value = normalizedLine.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values.set(key, value);
  }

  return values;
}

function getEnvFileArgs() {
  const files = [];

  for (let index = 2; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (arg === '--env-file') {
      const file = process.argv[index + 1];
      if (!file) {
        throw new Error('--env-file requires a file path');
      }
      files.push(file);
      index += 1;
    } else if (arg.startsWith('--env-file=')) {
      files.push(arg.slice('--env-file='.length));
    }
  }

  return files;
}

function readConfiguredMockDataValue() {
  const defaultFiles = ['.env', '.env.local', '.env.production', '.env.production.local'];
  const envFiles = getEnvFileArgs();
  const filesToRead = envFiles.length > 0 ? envFiles : defaultFiles;

  let value;
  let source;

  for (const file of filesToRead) {
    const filePath = resolve(process.cwd(), file);
    if (!existsSync(filePath)) {
      continue;
    }

    const values = parseEnvFile(filePath);
    if (values.has(ENV_VAR)) {
      value = values.get(ENV_VAR);
      source = file;
    }
  }

  if (process.env[ENV_VAR] !== undefined) {
    value = process.env[ENV_VAR];
    source = 'process.env';
  }

  return { source, value };
}

const { source, value } = readConfiguredMockDataValue();

if (value === 'true') {
  console.error(
    `[prod-mock-data-check] ${ENV_VAR}=true detected from ${source}. Production builds must set ${ENV_VAR}=false.`,
  );
  process.exit(1);
}

console.log(
  `[prod-mock-data-check] ${ENV_VAR} is not true${source ? ` (${source}: ${value})` : ' (unset)'}.`,
);
