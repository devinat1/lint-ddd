# no-redundant-type-constituents

Rule id: `@typescript-eslint/no-redundant-type-constituents`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

`bad.ts` writes `string | never`. `never` adds nothing to the union.

`good.ts` writes `string`.
