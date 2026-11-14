# no-unsafe-return

Rule id: `@typescript-eslint/no-unsafe-return`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

`bad.ts` returns `any` from a function whose return type is `string`.

`good.ts` returns a `string`.
