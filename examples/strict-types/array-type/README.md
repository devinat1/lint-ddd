# array-type

Rule id: `@typescript-eslint/array-type`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

The option is `default: "array"`. `bad.ts` writes `Array<string>`.

`good.ts` writes `string[]`.
