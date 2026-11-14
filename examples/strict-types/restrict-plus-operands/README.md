# restrict-plus-operands

Rule id: `@typescript-eslint/restrict-plus-operands`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

The options reject `any`, `boolean`, nullish values, a number mixed with a string, and `RegExp`. `bad.ts` adds a `number` to a `string` with `+`.

`good.ts` builds the label with a template string. Both operands of `+` in a sum should be numbers.
