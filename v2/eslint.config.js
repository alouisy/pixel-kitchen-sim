import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

const MSG = 'Non-deterministic API in simulation code: use @ga/shared prng/fmath.';
const BANNED_MATH = ['random', 'sin', 'cos', 'tan', 'exp', 'pow', 'log', 'atan2', 'hypot'];
const BANNED_GLOBALS = ['Date', 'performance', 'crypto'];

export default tseslint.config(
  // tools/ holds standalone Node scripts with their own conventions; not linted yet.
  { ignores: ['**/dist/**', '**/dist-types/**', '**/node_modules/**', 'tools/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    // Determinism rule: simulation + shared code must not touch non-deterministic APIs.
    // worker.ts is exempt (it owns the wall clock); tests are exempt.
    files: ['packages/sim/src/**/*.ts', 'packages/shared/src/**/*.ts'],
    ignores: ['packages/sim/src/worker.ts', '**/*.test.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...BANNED_MATH.map((property) => ({ object: 'Math', property, message: MSG })),
        { object: 'globalThis', property: 'Date', message: MSG },
        { object: 'globalThis', property: 'performance', message: MSG },
        { object: 'globalThis', property: 'crypto', message: MSG },
      ],
      'no-restricted-globals': ['error', ...BANNED_GLOBALS.map((name) => ({ name, message: MSG }))],
    },
  },
);
