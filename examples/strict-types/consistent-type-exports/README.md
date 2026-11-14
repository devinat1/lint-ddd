# consistent-type-exports

Rule id: `@typescript-eslint/consistent-type-exports`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

`bad.ts` exports the type `Order` with a value export.

`good.ts` uses `export type`.
