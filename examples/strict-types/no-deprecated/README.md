# no-deprecated

Rule id: `@typescript-eslint/no-deprecated`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

`bad.ts` calls `loadOrderId`. That function is marked `@deprecated`.

`good.ts` calls `readOrderId`.
