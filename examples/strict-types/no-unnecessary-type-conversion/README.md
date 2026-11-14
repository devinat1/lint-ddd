# no-unnecessary-type-conversion

Rule id: `@typescript-eslint/no-unnecessary-type-conversion`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

`bad.ts` wraps a `string` in `String()`. The value is already a string.

`good.ts` returns `name`.
