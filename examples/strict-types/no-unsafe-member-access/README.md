# no-unsafe-member-access

Rule id: `@typescript-eslint/no-unsafe-member-access`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

`bad.ts` reads `.id` on an `any` value.

`good.ts` reads `.id` on `{ id: string }`.
