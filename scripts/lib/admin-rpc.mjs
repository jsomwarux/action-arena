import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export function loadDotEnv() {
  const envPath = resolve(process.cwd(), '.env');

  if (!existsSync(envPath)) {
    return;
  }

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');

    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const value = trimmed.slice(equalsIndex + 1).trim().replace(/^['"]|['"]$/g, '');

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

export async function callAdminRpc(functionName, payload) {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL.');
  }

  if (!serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY. Add it to your shell or .env for this admin script.');
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${functionName}`, {
    body: JSON.stringify(payload),
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`${functionName} failed with ${response.status}: ${body}`);
  }

  return body ? JSON.parse(body) : null;
}

export function readIntegerOption(args, optionName) {
  const optionIndex = args.indexOf(optionName);

  if (optionIndex === -1) {
    return null;
  }

  const value = args[optionIndex + 1];
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    throw new Error(`Expected an integer after ${optionName}.`);
  }

  return parsed;
}

export function requireIntegerOption(args, optionName) {
  const parsed = readIntegerOption(args, optionName);

  if (parsed === null) {
    throw new Error(`Missing required option ${optionName}.`);
  }

  return parsed;
}

export function hasFlag(args, flagName) {
  return args.includes(flagName);
}
