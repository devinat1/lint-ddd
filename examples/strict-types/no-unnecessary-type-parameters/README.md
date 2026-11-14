# no-unnecessary-type-parameters

Rule id: `@typescript-eslint/no-unnecessary-type-parameters`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

`bad.ts` declares `<Value>` and uses it in only one position. The parameter does not connect two types.

`good.ts` names the argument `string`.
