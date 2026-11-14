# no-misused-promises

Rule id: `@typescript-eslint/no-misused-promises`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

`bad.ts` uses a `Promise<boolean>` as an `if` condition.

`good.ts` awaits that promise, then tests the boolean.
