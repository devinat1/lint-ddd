# consistent-type-imports

Rule id: `@typescript-eslint/consistent-type-imports`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

`bad.ts` imports `Order` as a value and uses it only as a type.

`good.ts` uses `import type`.
