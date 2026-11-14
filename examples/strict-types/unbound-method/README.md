# unbound-method

Rule id: `@typescript-eslint/unbound-method`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

`bad.ts` copies `clock.now` into `read`. The method no longer has its receiver.

`good.ts` calls `clock.now()` on the instance.
