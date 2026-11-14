# prettier

Rule id: `prettier/prettier`

Group: strict-types

Applies to: `**/*.{ts,tsx}` when the strict-types group is on. Type-aware rules also need `tsconfig.eslint.json`.

The options are `printWidth: 120`, `useTabs: false`, and `tabWidth: 2`. `bad.ts` indents the function body with a tab.

`good.ts` indents the function body with two spaces.
