# only-throw-error

Rule id: `@typescript-eslint/only-throw-error`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

`bad.ts` throws a string.

`good.ts` throws an `Error`.
