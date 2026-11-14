# no-unnecessary-type-assertion

Rule id: `@typescript-eslint/no-unnecessary-type-assertion`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

`bad.ts` asserts `"ada"` to `string`. The literal is already a string.

`good.ts` leaves the literal unasserted.
