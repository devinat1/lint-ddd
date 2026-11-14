# no-misused-spread

Rule id: `@typescript-eslint/no-misused-spread`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

`bad.ts` spreads a `string` into an object. A string spread copies numeric indexes, not text.

`good.ts` copies the string into a named field.
