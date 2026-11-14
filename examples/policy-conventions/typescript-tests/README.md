# typescript-tests

Rule id: `policy/typescript-tests`

Group: policy-conventions

Applies to: `{src,tests}/**/*.{ts,tsx,js,jsx,mjs,cjs}` whose file name matches `*.test.*` or `*.spec.*`

The file name is the violation. `order.test.js` and `order.spec.ts` are product tests, and neither name ends in `.test.ts`.

`order.test.ts` is the accepted product test name. `tooling/tests/*.test.mjs` stays JavaScript because those tests exercise the ESLint config, and this rule does not apply under `tooling/`.
