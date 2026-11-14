# return-await

Rule id: `@typescript-eslint/return-await`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

The option is `in-try-catch`. `bad.ts` returns a promise from `try` without `await`, so a rejection can skip `catch`.

`good.ts` returns `await fetchText()` inside `try`.
