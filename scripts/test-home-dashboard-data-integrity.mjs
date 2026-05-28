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
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });

  module._compile(transpiled.outputText, filename);
};

const { summarizeRecentResults } = require(path.join(root, 'lib/home-results.ts'));
const { formatPickTitle } = require(path.join(root, 'lib/pick-labels.ts'));

let nextBetId = 1;

function leg(overrides = {}) {
  return {
    adjusted_line: -3.5,
    bet_id: '',
    game_id: `home-result-game-${nextBetId}`,
    game_start_time: '2026-09-01T17:00:00.000Z',
    id: `home-result-leg-${nextBetId}-${Math.random().toString(36).slice(2)}`,
    leg_odds: -110,
    locked: true,
    market: 'spread',
    original_line: -3.5,
    result: 'win',
    selection: 'Buffalo Bills -3.5',
    ...overrides,
  };
}

function bet(overrides = {}) {
  const id = `home-result-bet-${nextBetId++}`;
  const result = overrides.result ?? 'win';
  const profit =
    Object.prototype.hasOwnProperty.call(overrides, 'profit')
      ? overrides.profit
      : result === 'win'
        ? 7
        : result === 'loss'
          ? -20
          : result === 'push'
            ? 0
            : null;
  const legs =
    overrides.bet_legs ??
    [leg({ bet_id: id, result: result === 'pending' ? 'pending' : result })];

  return {
    amount: 20,
    bet_legs: legs,
    bet_type: 'straight',
    created_at: `2026-09-${String(nextBetId).padStart(2, '0')}T12:00:00.000Z`,
    id,
    is_lock: false,
    league_id: 'league-a',
    odds: -110,
    potential_payout: 38.18,
    profit,
    result,
    teaser_points: null,
    user_id: 'user-a',
    week_number: 1,
    ...overrides,
  };
}

const settledWin = bet({ profit: 7, result: 'win' });
const settledLoss = bet({
  bet_legs: [
    leg({
      adjusted_line: null,
      market: 'moneyline',
      original_line: null,
      result: 'loss',
      selection: 'Miami Dolphins',
    }),
  ],
  odds: 120,
  profit: -20,
  result: 'loss',
});
const pendingPick = bet({
  bet_legs: [leg({ result: 'pending', selection: 'Seattle Seahawks +1.5' })],
  is_lock: true,
  profit: null,
  result: 'pending',
});

const settledSummary = summarizeRecentResults([pendingPick, settledWin, settledLoss]);
assert.equal(settledSummary.hasSettledPicks, true);
assert.equal(settledSummary.profit, -13);
assert.equal(settledSummary.biggestWin?.id, settledWin.id);
assert.equal(settledSummary.biggestLoss?.id, settledLoss.id);
assert.equal(formatPickTitle(settledSummary.biggestWin), 'Buffalo Bills -3.5');

const pendingSummary = summarizeRecentResults([pendingPick]);
assert.equal(pendingSummary.hasSettledPicks, false);
assert.equal(pendingSummary.profit, null);
assert.equal(pendingSummary.biggestWin, null);
assert.equal(pendingSummary.biggestLoss, null);

const emptySummary = summarizeRecentResults([]);
assert.equal(emptySummary.hasSettledPicks, false);
assert.equal(emptySummary.profit, null);

console.log('Home dashboard data integrity regression tests passed.');
