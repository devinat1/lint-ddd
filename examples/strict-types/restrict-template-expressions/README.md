# restrict-template-expressions

Rule id: `@typescript-eslint/restrict-template-expressions`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

The options set `allowAny: false` and `allowNullish: false`. `bad.ts` interpolates `unknown`.

`good.ts` interpolates a `string`.
