# no-unsafe-argument

Rule id: `@typescript-eslint/no-unsafe-argument`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

`bad.ts` passes the `any` result of `read()` to `print`, which expects a `string`.

`good.ts` passes a `string`.
