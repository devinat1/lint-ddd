# no-magic-numbers

Rule id: `@typescript-eslint/no-magic-numbers`

Group: validation

Applies to: `src/**/*.{ts,tsx}`

`bad.ts` passes `250` straight into `setTimeout`. `-1`, `0`, and `1` are ignored, as are array indexes, enums, numeric literal types, type indexes, and readonly class properties.

`good.ts` names the delay `retryDelayMs`. `enforceConst` means that binding is a `const`.
