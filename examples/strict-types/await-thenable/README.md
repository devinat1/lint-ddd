# await-thenable

Rule id: `@typescript-eslint/await-thenable`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

`bad.ts` awaits a `number`. Await is for a thenable.

`good.ts` awaits a `Promise<number>`.
