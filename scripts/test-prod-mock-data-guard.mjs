import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync('lib/mock-data-safety.ts', 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;

function loadGuardModule({ isDev, useMockData }) {
  const module = { exports: {} };
  const context = {
    __DEV__: isDev,
    exports: module.exports,
    module,
    process: {
      env: {
        EXPO_PUBLIC_USE_MOCK_DATA: useMockData,
      },
    },
  };

  vm.runInNewContext(transpiled, context, { filename: 'lib/mock-data-safety.ts' });

  return module.exports;
}

const { assertProductionMockDataDisabled } = loadGuardModule({
  isDev: true,
  useMockData: 'true',
});

assert.doesNotThrow(() =>
  assertProductionMockDataDisabled({ isDev: true, useMockData: 'true' }),
);
assert.doesNotThrow(() =>
  assertProductionMockDataDisabled({ isDev: false, useMockData: 'false' }),
);
assert.throws(
  () => assertProductionMockDataDisabled({ isDev: false, useMockData: 'true' }),
  /EXPO_PUBLIC_USE_MOCK_DATA/,
);

const productionSafeModule = loadGuardModule({
  isDev: false,
  useMockData: undefined,
});

assert.doesNotThrow(() => productionSafeModule.assertProductionMockDataDisabled());

const productionModule = loadGuardModule({
  isDev: false,
  useMockData: 'true',
});

assert.throws(
  () => productionModule.assertProductionMockDataDisabled(),
  /EXPO_PUBLIC_USE_MOCK_DATA/,
);

console.log('Production mock data guard regression tests passed.');
