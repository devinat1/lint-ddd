# no-duplicate-type-constituents

Rule id: `@typescript-eslint/no-duplicate-type-constituents`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

`bad.ts` writes `string | string`. The two constituents are the same.

`good.ts` writes `string`.
