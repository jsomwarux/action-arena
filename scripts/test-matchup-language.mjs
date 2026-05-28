#!/usr/bin/env node

import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import Module from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const originalLoad = Module._load;
Module._load = function loadWithAppAliases(request, parent, isMain) {
  if (request.startsWith('@/')) {
    const candidate = path.join(root, `${request.slice(2)}.ts`);

    if (fs.existsSync(candidate)) {
      return require(candidate);
    }
  }

  return originalLoad.call(this, request, parent, isMain);
};

require.extensions['.ts'] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const { getMatchupSideStatus, getProfitSwingHeadline } = require(
  path.join(root, 'lib/matchup-language.ts'),
);

const matchup = {
  awayName: 'Fourth Quarter Force',
  awayProfit: 32,
  awayUserId: 'away-user',
  homeName: 'Sunday Syndicate',
  homeProfit: 118,
  homeUserId: 'home-user',
};

assert.equal(
  getMatchupSideStatus({
    opposingProfit: matchup.awayProfit,
    sideProfit: matchup.homeProfit,
    sideUserId: matchup.homeUserId,
    winnerId: null,
  }),
  'leading',
);
assert.equal(
  getMatchupSideStatus({
    opposingProfit: matchup.homeProfit,
    sideProfit: matchup.awayProfit,
    sideUserId: matchup.awayUserId,
    winnerId: null,
  }),
  'trailing',
);
assert.equal(
  getProfitSwingHeadline({ ...matchup, winnerId: null }),
  'Sunday Syndicate leads by 86 coins',
);

assert.equal(
  getMatchupSideStatus({
    opposingProfit: matchup.awayProfit,
    sideProfit: matchup.homeProfit,
    sideUserId: matchup.homeUserId,
    winnerId: matchup.homeUserId,
  }),
  'won',
);
assert.equal(
  getMatchupSideStatus({
    opposingProfit: matchup.homeProfit,
    sideProfit: matchup.awayProfit,
    sideUserId: matchup.awayUserId,
    winnerId: matchup.homeUserId,
  }),
  'lost',
);
assert.equal(
  getProfitSwingHeadline({ ...matchup, winnerId: matchup.homeUserId }),
  'Sunday Syndicate won by 86 coins',
);

console.log('Matchup language regression tests passed.');
