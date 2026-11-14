# no-unsafe-call

Rule id: `@typescript-eslint/no-unsafe-call`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

`bad.ts` calls the `any` value returned by `read()`.

`good.ts` calls a function typed as `() => string`.
