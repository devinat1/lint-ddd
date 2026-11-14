# no-base-to-string

Rule id: `@typescript-eslint/no-base-to-string`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

`bad.ts` drops an object into a template string. The object has no useful string conversion.

`good.ts` interpolates `order.id`.
