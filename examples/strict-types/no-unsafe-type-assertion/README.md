# no-unsafe-type-assertion

Rule id: `@typescript-eslint/no-unsafe-type-assertion`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

`bad.ts` asserts `unknown` to `string`.

`good.ts` checks `typeof value === "string"` before using it as a string.
