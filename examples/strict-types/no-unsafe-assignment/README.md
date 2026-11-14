# no-unsafe-assignment

Rule id: `@typescript-eslint/no-unsafe-assignment`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

`bad.ts` assigns the `any` result of `read()` to a `string`.

`good.ts` assigns a `string` to a `string`.
