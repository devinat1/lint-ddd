# strict-boolean-expressions

Rule id: `@typescript-eslint/strict-boolean-expressions`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

The options set `allowString: false` and `allowNumber: false`. `bad.ts` uses a `string` as the condition.

`good.ts` compares the string with `!== ""`. A boolean such as `isReady` can be a condition directly.
