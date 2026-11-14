# codely

Rule ids: none. This group turns on `eslint-config-codely`.

Group: codely

Applies to: the files the Codely preset selects.

`imports.bad.ts` imports `./b.js` before `./a.js`. The preset wants imports in sorted order.

`imports.good.ts` imports `./a.js` first.

`unused.bad.ts` imports `formatMoney` and never reads it. The preset removes unused imports.

`unused.good.ts` reads `formatMoney`.

`prettier.bad.js` indents JavaScript with spaces. Codely formats JavaScript with tabs.

`prettier.good.js` indents that function with a tab.

TypeScript formatting for this package is the separate `prettier/prettier` rule in `strict-types`. That rule uses two spaces.
