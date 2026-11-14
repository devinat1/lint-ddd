# no-explicit-any

Rule id: `@typescript-eslint/no-explicit-any`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

`bad.ts` annotates `value` as `any`.

`good.ts` annotates `value` as `number`.
